#!/usr/bin/env node
/**
 * Reapplies the quoting fixes that let this project build from a path
 * containing spaces.
 *
 * Several Expo and React Native build scripts interpolate paths into shell
 * commands without quoting them. From a directory like "untitled folder 25"
 * they fail with `bash: /Users/…/untitled: No such file or directory` — the
 * shell reads the first word as the command and the rest as arguments.
 *
 * These edits live in generated project files, so `expo prebuild` and
 * `pod install` both discard them. Run this after either.
 *
 * The permanent fix is a project path without spaces; this exists so a build
 * is possible in the meantime, and it is a no-op once the path is clean.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ios = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'ios');

if (!/\s/.test(ios)) {
  console.log('Project path has no spaces — nothing to patch.');
  process.exit(0);
}

const edits = [
  {
    file: path.join(ios, 'Pods', 'Pods.xcodeproj', 'project.pbxproj'),
    label: 'expo-constants app.config generator',
    // `bash -l -c "<path>"` re-parses its argument as a command line. Invoke the
    // script directly; the login shell bought nothing, since the script sources
    // .xcode.env itself.
    from: 'shellScript = "bash -l -c \\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"";',
    to: 'shellScript = "/bin/bash \\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"";',
  },
  {
    file: path.join(ios, 'SplitUpPreview.xcodeproj', 'project.pbxproj'),
    label: 'React Native bundler',
    // Backtick substitution whose output is a path, then executed unquoted.
    from: "`\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\"`",
    to: "REACT_NATIVE_XCODE_SCRIPT=$(\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\")\\n/bin/sh \\\"$REACT_NATIVE_XCODE_SCRIPT\\\"",
  },
];

let applied = 0;
let already = 0;

for (const edit of edits) {
  if (!existsSync(edit.file)) {
    console.log(`skipped  ${edit.label} — ${path.basename(edit.file)} not generated yet`);
    continue;
  }
  const before = readFileSync(edit.file, 'utf8');
  if (before.includes(edit.to)) {
    already += 1;
    console.log(`ok       ${edit.label} — already patched`);
    continue;
  }
  if (!before.includes(edit.from)) {
    console.warn(`WARNING  ${edit.label} — expected text not found; upstream may have changed`);
    continue;
  }
  writeFileSync(edit.file, before.replace(edit.from, edit.to));
  applied += 1;
  console.log(`patched  ${edit.label}`);
}

console.log(`\n${applied} applied, ${already} already in place.`);
