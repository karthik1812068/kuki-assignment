function quote(file) {
  return `"${file.replaceAll('"', '\\"')}"`;
}

function chunk(files, size) {
  const groups = [];
  for (let index = 0; index < files.length; index += size) {
    groups.push(files.slice(index, index + size));
  }
  return groups;
}

function batched(command, size) {
  return (files) => chunk(files, size).map((group) => `${command} ${group.map(quote).join(' ')}`);
}

export default {
  '*.{ts,tsx,js,mjs,css,json,md,yml,yaml}': batched('prettier --write', 12),
  '*.{ts,tsx}': batched('eslint --fix', 8),
};
