module.exports = function verify(source) {
  let lines = source.split(/\n/g);
  let spaces = lines.filter((line) => /^ +/.exec(line)).length;
  let tabs = lines.filter((line) => /^\t+/.exec(line)).length;
  let mixed = lines.filter((line) => /^ +\t+/.exec(line)).length;

  if (spaces && tabs || mixed) {
    return [spaces, tabs, mixed];
  }
  return false;
}
