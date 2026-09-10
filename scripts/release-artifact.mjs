// scripts/release-artifact.mjs
// prepare and verify one immutable extension release artifact

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  });
}

export function releaseNotes(changelog, version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = changelog.match(
    new RegExp(
      `^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|$(?![\\s\\S]))`,
      'm'
    )
  );
  if (
    !match?.[1]
      .replace(/^#{1,6}.*$/gm, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim()
  ) {
    throw new Error(`Missing nonempty changelog entry for ${version}`);
  }
  return match[1].trim() + '\n';
}

export function verifyArtifact(directory, expectedVersion) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, 'release.json'), 'utf8')
  );
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.version, expectedVersion);
  assert.equal(manifest.file, `vsc-mdx-preview-${expectedVersion}.vsix`);
  const artifact = path.join(directory, manifest.file);
  assert.equal(
    digest(fs.readFileSync(artifact)),
    manifest.sha256,
    'VSIX checksum mismatch'
  );
  assert.equal(
    fs.readFileSync(path.join(directory, 'SHA256SUMS'), 'utf8'),
    `${manifest.sha256}  ${manifest.file}\n`
  );
  assert.equal(
    digest(fs.readFileSync(path.join(directory, 'release-notes.md'))),
    manifest.notesSha256,
    'Release notes checksum mismatch'
  );
  return { ...manifest, artifact };
}

async function prepare(directory, candidate) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8')
  );
  assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/);
  const sourceSha = run('git', ['rev-parse', 'HEAD']).trim();
  if (!candidate) {
    assert.equal(
      process.env.GITHUB_REF,
      `refs/tags/v${pkg.version}`,
      'Tag and manifest differ'
    );
    assert.equal(
      run('git', ['rev-parse', `v${pkg.version}^{commit}`]).trim(),
      sourceSha
    );
    run('git', ['merge-base', '--is-ancestor', sourceSha, 'origin/main']);
    assert.equal(
      run('git', ['status', '--porcelain']).trim(),
      '',
      'Release checkout must be clean'
    );
  }
  const notes = releaseNotes(
    fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'),
    pkg.version
  );
  fs.mkdirSync(directory, { recursive: true });
  const file = `vsc-mdx-preview-${pkg.version}.vsix`;
  const artifact = path.join(directory, file);
  assert.equal(
    fs.existsSync(artifact),
    false,
    'Refusing to replace an existing candidate'
  );
  run(
    path.join(root, 'node_modules/.bin/vsce'),
    ['package', '--no-dependencies', '--no-yarn', '--out', artifact],
    { stdio: 'inherit' }
  );
  run('npm', ['run', 'check:import-meta-shim'], { stdio: 'inherit' });
  const packedManifest = JSON.parse(
    run('unzip', ['-p', artifact, 'extension/package.json'])
  );
  assert.equal(
    packedManifest.version,
    pkg.version,
    'Packed manifest version differs'
  );
  assert.equal(
    packedManifest.name,
    pkg.name,
    'Packed extension identity differs'
  );
  const sha256 = digest(fs.readFileSync(artifact));
  fs.writeFileSync(path.join(directory, 'release-notes.md'), notes);
  fs.writeFileSync(path.join(directory, 'SHA256SUMS'), `${sha256}  ${file}\n`);
  fs.writeFileSync(
    path.join(directory, 'release.json'),
    JSON.stringify(
      {
        schema: 1,
        version: pkg.version,
        sourceSha,
        candidate,
        file,
        sha256,
        notesSha256: digest(notes),
      },
      null,
      2
    ) + '\n'
  );
  console.log(JSON.stringify(verifyArtifact(directory, pkg.version)));
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60000),
    ...options,
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(
      `Registry request failed (${response.status}): ${new URL(url).hostname}`
    );
  }
  return response;
}

async function verifyRemote(response, sha256) {
  assert(response, 'Published artifact is missing');
  assert.equal(
    digest(Buffer.from(await response.arrayBuffer())),
    sha256,
    'Existing registry artifact differs; manual reconciliation required'
  );
}

export async function publishArtifact(directory, version, adapters) {
  const result = verifyArtifact(directory, version);
  const statuses = {};
  let failed = false;
  for (const [name, adapter] of Object.entries(adapters)) {
    try {
      // recheck bytes before each destination observes the artifact
      verifyArtifact(directory, version);
      statuses[name] = await adapter(result);
    } catch (error) {
      failed = true;
      statuses[name] = {
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      };
    }
    fs.writeFileSync(
      path.join(directory, 'publication.json'),
      JSON.stringify({ version, sha256: result.sha256, statuses }, null, 2) +
        '\n'
    );
  }
  if (failed) {
    throw new Error(
      'Publication incomplete; inspect publication.json and retry with this retained artifact'
    );
  }
  return statuses;
}

function registryAdapters(directory, version) {
  const packagePath = `ggfincke/vsc-mdx-preview/${version}`;
  const githubApi = `https://api.github.com/repos/ggfincke/vsc-mdx-preview/releases/tags/v${version}`;
  const githubHeaders = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
  };
  return {
    marketplace: async ({ artifact, sha256 }) => {
      const url = `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/ggfincke/vsextensions/vsc-mdx-preview/${version}/vspackage`;
      const existing = await request(url);
      if (existing) {
        await verifyRemote(existing, sha256);
        return 'already verified';
      }
      run(
        path.join(root, 'node_modules/.bin/vsce'),
        ['publish', '--packagePath', artifact],
        { stdio: 'inherit' }
      );
      await verifyRemote(await request(url), sha256);
      return 'published and verified';
    },
    openvsx: async ({ artifact, sha256 }) => {
      const url = `https://open-vsx.org/api/${packagePath}`;
      const existing = await request(url);
      if (existing) {
        const metadata = await existing.json();
        await verifyRemote(await request(metadata.files.download), sha256);
        return 'already verified';
      }
      run(path.join(root, 'node_modules/.bin/ovsx'), ['publish', artifact], {
        stdio: 'inherit',
      });
      const metadata = await request(url);
      assert(metadata, 'OpenVSX version missing after publish');
      await verifyRemote(
        await request((await metadata.json()).files.download),
        sha256
      );
      return 'published and verified';
    },
    github: async ({ artifact, file, sha256 }) => {
      const existing = await request(githubApi, { headers: githubHeaders });
      if (existing) {
        const release = await existing.json();
        const asset = release.assets.find((item) => item.name === file);
        if (asset) {
          await verifyRemote(await request(asset.browser_download_url), sha256);
        } else {
          run(
            'gh',
            [
              'release',
              'upload',
              `v${version}`,
              artifact,
              '--repo',
              'ggfincke/vsc-mdx-preview',
            ],
            { stdio: 'inherit' }
          );
        }
        run(
          'gh',
          [
            'release',
            'upload',
            `v${version}`,
            path.join(directory, 'SHA256SUMS'),
            path.join(directory, 'release.json'),
            '--clobber',
            '--repo',
            'ggfincke/vsc-mdx-preview',
          ],
          { stdio: 'inherit' }
        );
      } else {
        run(
          'gh',
          [
            'release',
            'create',
            `v${version}`,
            artifact,
            path.join(directory, 'SHA256SUMS'),
            path.join(directory, 'release.json'),
            '--verify-tag',
            '--title',
            `v${version}`,
            '--notes-file',
            path.join(directory, 'release-notes.md'),
            '--repo',
            'ggfincke/vsc-mdx-preview',
            ...(version.includes('-') ? ['--prerelease'] : []),
          ],
          { stdio: 'inherit' }
        );
      }
      const published = await request(githubApi, { headers: githubHeaders });
      assert(published, 'GitHub release missing after publish');
      const asset = (await published.json()).assets.find(
        (item) => item.name === file
      );
      assert(asset, 'GitHub VSIX asset missing after publish');
      await verifyRemote(await request(asset.browser_download_url), sha256);
      return 'published and verified';
    },
  };
}

async function exercise() {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'mdx-release-exercise-')
  );
  const version = '1.2.3';
  const file = `vsc-mdx-preview-${version}.vsix`;
  const bytes = Buffer.from('deterministic dry-run VSIX');
  const sha256 = digest(bytes);
  const notes = 'Release exercise\n';
  fs.writeFileSync(path.join(directory, file), bytes);
  fs.writeFileSync(path.join(directory, 'release-notes.md'), notes);
  fs.writeFileSync(path.join(directory, 'SHA256SUMS'), `${sha256}  ${file}\n`);
  fs.writeFileSync(
    path.join(directory, 'release.json'),
    JSON.stringify({
      schema: 1,
      version,
      file,
      sha256,
      notesSha256: digest(notes),
    })
  );
  assert.throws(() => verifyArtifact(directory, '9.9.9'));
  assert.throws(() => releaseNotes('## [1.2.3]\n\n', version));
  assert.equal(
    releaseNotes('## [1.2.3] - Today\n\nFixed.\n\n## [1.2.2]\nOld.', version),
    'Fixed.\n'
  );
  assert.throws(() => releaseNotes('## [1.2.3]\n\n### Fixed\n', version));
  const observed = [];
  const adapter = async (artifact) => {
    observed.push([artifact.artifact, artifact.sha256]);
    return 'verified';
  };
  await publishArtifact(directory, version, {
    marketplace: adapter,
    openvsx: adapter,
    github: adapter,
  });
  assert.equal(new Set(observed.map((item) => JSON.stringify(item))).size, 1);
  await assert.rejects(() =>
    publishArtifact(directory, version, {
      marketplace: adapter,
      openvsx: async () => {
        throw new Error('deliberate destination failure');
      },
      github: adapter,
    })
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(directory, 'publication.json')))
      .statuses.openvsx.status,
    'failed'
  );
  let resumed = 0;
  const alreadyPresent = async () => 'already verified';
  await publishArtifact(directory, version, {
    marketplace: alreadyPresent,
    openvsx: async (artifact) => {
      resumed++;
      return adapter(artifact);
    },
    github: alreadyPresent,
  });
  assert.equal(resumed, 1);
  fs.appendFileSync(path.join(directory, file), 'changed');
  assert.throws(() => verifyArtifact(directory, version));
  console.log(
    `Release exercise passed: version, notes, identical destinations, partial failure, checksum (${directory})`
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command, destination = '../.artifacts/maintenance/preview', version] =
    process.argv.slice(2);
  const directory = path.resolve(root, destination);
  try {
    if (command === 'prepare') {
      await prepare(directory, process.argv.includes('--candidate'));
    } else if (command === 'verify') {
      console.log(JSON.stringify(verifyArtifact(directory, version)));
    } else if (command === 'publish') {
      const artifact = verifyArtifact(directory, version);
      assert.equal(
        artifact.candidate,
        false,
        'Local candidates require a reviewed release preparation'
      );
      assert.equal(process.env.GITHUB_REF, `refs/tags/v${version}`);
      assert.equal(artifact.sourceSha, process.env.GITHUB_SHA);
      console.log(
        await publishArtifact(
          directory,
          version,
          registryAdapters(directory, version)
        )
      );
    } else if (command === 'exercise') {
      await exercise();
    } else {
      throw new Error(
        'Use prepare <directory> [--candidate], verify/publish <directory> <version>, or exercise'
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
