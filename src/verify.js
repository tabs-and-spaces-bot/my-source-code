module.exports = function verify(source) {
  let lines = source.split(/\n/g);
  let spaces = 0;
  let tabs = 0;
  let mixed = 0;
  for (let line of lines) {
    if (line.match(/^ +/)) spaces++;
    else if (line.match(/^\t+/)) tabs++;
    if (line.match(/^ +\t+/)) mixed++;
  }

  if (spaces && tabs || mixed) {
    return [spaces, tabs, mixed];
  }
  return false;
}
