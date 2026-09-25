import {
  DETECTED_FRAMEWORKS,
  DETECTED_LANGUAGES,
  DETECTED_PACKAGE_MANAGERS,
  DETECTED_TEST_FRAMEWORKS,
} from '@codepilot/types';

export interface IndexDetection {
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  testFrameworks: string[];
}

interface Manifest {
  path: string;
  text: string;
}

const LANGUAGE_ORDER = new Map(DETECTED_LANGUAGES.map((language, index) => [language, index]));
const FRAMEWORK_ORDER = new Map(DETECTED_FRAMEWORKS.map((name, index) => [name, index]));
const PACKAGE_ORDER = new Map(DETECTED_PACKAGE_MANAGERS.map((name, index) => [name, index]));
const TEST_ORDER = new Map(DETECTED_TEST_FRAMEWORKS.map((name, index) => [name, index]));

export function detectProject(
  files: readonly Manifest[],
  markers: readonly string[],
): IndexDetection {
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const packageManagers = new Set<string>();
  const testFrameworks = new Set<string>();
  const names = new Set<string>();

  for (const file of files) {
    names.add(basename(file.path));
    const language = languageFromPath(file.path);
    if (language) {
      languages.add(language);
    }
  }
  for (const marker of markers) {
    names.add(basename(marker));
  }

  if (names.has('pnpm-lock.yaml')) {
    packageManagers.add('pnpm');
  }
  if (names.has('yarn.lock')) {
    packageManagers.add('yarn');
  }
  if (
    names.has('package-lock.json') ||
    (names.has('package.json') && !names.has('pnpm-lock.yaml') && !names.has('yarn.lock'))
  ) {
    packageManagers.add('npm');
  }
  if (names.has('go.mod')) {
    packageManagers.add('Go modules');
  }
  if (names.has('Cargo.toml')) {
    packageManagers.add('Cargo');
  }
  if (names.has('requirements.txt') || names.has('pyproject.toml')) {
    packageManagers.add('pip');
  }
  if (names.has('Gemfile')) {
    packageManagers.add('Bundler');
  }
  if (names.has('pom.xml')) {
    packageManagers.add('Maven');
  }
  if (names.has('build.gradle') || names.has('build.gradle.kts')) {
    packageManagers.add('Gradle');
  }

  for (const file of files) {
    const name = basename(file.path);
    if (name === 'package.json') {
      readPackageJson(file.text, frameworks, testFrameworks);
    } else if (name === 'requirements.txt' || name === 'pyproject.toml') {
      readPythonManifest(file.text, frameworks, testFrameworks);
    } else if (name === 'go.mod' && file.text.includes('github.com/gin-gonic/gin')) {
      frameworks.add('Gin');
    } else if (name === 'Cargo.toml' && /^\s*actix-web\s*=/m.test(file.text)) {
      frameworks.add('Actix');
    } else if (
      (name === 'pom.xml' || name === 'build.gradle' || name === 'build.gradle.kts') &&
      file.text.includes('spring-boot')
    ) {
      frameworks.add('Spring');
    }
    if (
      (name === 'pom.xml' || name === 'build.gradle' || name === 'build.gradle.kts') &&
      /junit/i.test(file.text)
    ) {
      testFrameworks.add('JUnit');
    }
    if (file.path.endsWith('_test.go')) {
      testFrameworks.add('go test');
    }
    if (
      names.has('Cargo.toml') &&
      (file.path.includes('/tests/') || file.path.endsWith('_test.rs'))
    ) {
      testFrameworks.add('cargo test');
    }
  }

  if (
    [...names].some(
      (name) =>
        name === 'next.config.js' || name === 'next.config.mjs' || name === 'next.config.ts',
    )
  ) {
    frameworks.add('Next.js');
  }
  if (names.has('nest-cli.json')) {
    frameworks.add('NestJS');
  }
  if (names.has('manage.py')) {
    frameworks.add('Django');
  }

  return {
    languages: ordered(languages, LANGUAGE_ORDER),
    frameworks: ordered(frameworks, FRAMEWORK_ORDER),
    packageManagers: ordered(packageManagers, PACKAGE_ORDER),
    testFrameworks: ordered(testFrameworks, TEST_ORDER),
  };
}

function readPackageJson(text: string, frameworks: Set<string>, testFrameworks: Set<string>): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== 'object') {
    return;
  }
  const record = parsed as Record<string, unknown>;
  const names = new Set<string>();
  for (const key of ['dependencies', 'devDependencies']) {
    const value = record[key];
    if (!value || typeof value !== 'object') {
      continue;
    }
    for (const name of Object.keys(value)) {
      names.add(name);
    }
  }
  if (names.has('next')) {
    frameworks.add('Next.js');
  }
  if (names.has('@nestjs/core') || names.has('@nestjs/common')) {
    frameworks.add('NestJS');
  }
  if (names.has('react')) {
    frameworks.add('React');
  }
  if (names.has('express')) {
    frameworks.add('Express');
  }
  if (names.has('vitest')) {
    testFrameworks.add('Vitest');
  }
  if (names.has('jest')) {
    testFrameworks.add('Jest');
  }
  if (names.has('mocha')) {
    testFrameworks.add('Mocha');
  }
}

function readPythonManifest(
  text: string,
  frameworks: Set<string>,
  testFrameworks: Set<string>,
): void {
  const names = new Set<string>();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }
    const name = trimmed
      .split(/[=<>!~[\s]/, 1)[0]
      ?.replace(/['"]/g, '')
      .toLowerCase();
    if (name) {
      names.add(name);
    }
  }
  if (names.has('django')) {
    frameworks.add('Django');
  }
  if (names.has('flask')) {
    frameworks.add('Flask');
  }
  if (names.has('pytest')) {
    testFrameworks.add('pytest');
  }
}

const INDEXABLE_NAMES = new Set([
  'Dockerfile',
  'Gemfile',
  'Makefile',
  'build.gradle',
  'build.gradle.kts',
  'go.mod',
  'manage.py',
  'nest-cli.json',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'package.json',
  'pom.xml',
  'pyproject.toml',
  'requirements.txt',
  'Cargo.toml',
]);

export function isIndexableFile(filePath: string): boolean {
  const name = basename(filePath);
  if (INDEXABLE_NAMES.has(name) || name.endsWith('.txt')) {
    return true;
  }
  return languageFromPath(filePath) !== null;
}

export function languageFromPath(filePath: string): string | null {
  const name = basename(filePath);
  if (name === 'Dockerfile') {
    return 'Dockerfile';
  }
  const dot = name.lastIndexOf('.');
  if (dot <= 0) {
    return null;
  }
  const extension = name.slice(dot).toLowerCase();
  switch (extension) {
    case '.ts':
    case '.tsx':
      return 'TypeScript';
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'JavaScript';
    case '.py':
      return 'Python';
    case '.go':
      return 'Go';
    case '.rs':
      return 'Rust';
    case '.java':
      return 'Java';
    case '.rb':
      return 'Ruby';
    case '.md':
      return 'Markdown';
    case '.json':
      return 'JSON';
    case '.yml':
    case '.yaml':
      return 'YAML';
    case '.toml':
      return 'TOML';
    case '.css':
      return 'CSS';
    case '.html':
      return 'HTML';
    case '.sql':
      return 'SQL';
    case '.sh':
      return 'Shell';
    default:
      return null;
  }
}

function basename(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  return slash === -1 ? filePath : filePath.slice(slash + 1);
}

function ordered(values: Set<string>, order: Map<string, number>): string[] {
  return [...values].sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
}
