const fs = require("fs");
const path = require("path");
const query = require("./query.js");
const verify = require("./verify.js");
const mime = require("mime");
const settings = require("../settings.json");

const repo_stack = [];
const user_stack = [];
const file_stack = [];

let n_files = 0;
let n_repos = 0;

if (!fs.readdirSync(path.resolve(__dirname, "..")).includes("commits.json")) {
  fs.writeFileSync(path.resolve(__dirname, "../commits.json"), "{}", "utf8");
}

let last_commits = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../commits.json")));

module.exports = function handler(client, me) {
  console.log(`Listing followers...`);
  me.listFollowers(async (err, followers) => {
    if (err) throw err; // TODO: handle it better
    let repos = await query.repos(followers);
    let promises = [];
    console.log(`Checking files...`);
    let n = 0;
    for (let repo of repos) {
      n++;
      console.log(`${repo.full_name} (${n}/${repos.length})`);

      let issues = await query.issues(repo);
      let should_handle = true;
      for (let issue of issues) {
        if (issue.user.login === settings.username) {
          let comments = await query.issue_comments(repo, issue.number);
          // Don't do anything if they want me to leave them alone
          if (comments.find(comment => /^\*{0,2}leave (?:us|me) alone[.!]?\*{0,2}$/i.exec(comment.body))) {
            should_handle = false;
          }
        }
      }

      let master = await query.master(repo);
      if (master.commit.sha === last_commits[repo.full_name]) {
        should_handle = false;
      } else {
        last_commits[repo.full_name] = master.commit.sha;
      }
      if (should_handle) {
        n_repos++;
        promises.push(handle_repo(repo));
      }
    }
    let to_audit = await Promise.all(promises);

    console.log(`Checked ${n_files} files in ${n_repos} repos.`);
    console.log(`Found ${to_audit.reduce((acc, act) => acc + act.to_audit.length, 0)} files to audit, in ${to_audit.filter(x => x.to_audit.length).length} repositories.`);

    for (let repo of to_audit) {
      handle_issues(repo);
    }

    fs.writeFileSync(path.resolve(__dirname, "../commits.json"), JSON.stringify(last_commits), "utf8");
  });
}

function handle_repo(repo) {
  return new Promise((resolve, reject) => {
    query.files(repo).then(async (files) => {
      let to_audit = [];
      n_files += files.length;

      for (let file of files) {
        let type = mime.getType(file[1]);
        let is_text = type && (type.startsWith("text/") || type === "application/javascript" || type === "application/json");
        if (is_text && file[0].size < (settings.max_file_size || 250000)) {
          let contents = await query.file(repo, file);
          if (typeof contents !== "string") continue;
          let result = verify(contents);
          if (result) {
            to_audit.push([file[0], file[1], result]);
          }
        }
      }
      resolve({
        repo,
        to_audit
      });
    }).catch(reject);
  });
}

async function handle_issues({repo, to_audit}) {
  if (to_audit.length === 0) return;
  // let issues = client.getIssues(repo.owner.login, repo.name);
  let issues = await query.issues(repo);
  let my_issue = issues.find(issue => issue.user.login === settings.username && issue.state === "open");
  if (my_issue) update_issue(repo, my_issue, to_audit);
  else create_issue(repo, to_audit);
}

function update_issue(repo, my_issue, to_audit) {
  let issues = client.getIssues(repo.owner.login, repo.name);
  let body = gen_body(to_audit);

  issues.editIssue(my_issue.number, {
    ...my_issue,
    body
  });
}

function create_issue(repo, to_audit) {
  let issues = client.getIssues(repo.owner.login, repo.name);
  let body = gen_body(to_audit);
  issues.createIssue({
    title: "Mixed tabs and spaces [BOT]",
    body
  }, (err, res) => {
    if (err) console.error(err);
    console.log(res);
  });
}

function gen_body(to_audit) {
  let result = `Hi, I have found **${to_audit.length}** files containing a mix of tabs and spaces!\n\n`;
  result += `These are:\n\n`;
  for (let [file, path, [spaces, tabs, mixed]] of to_audit) {
    result += `* \`${path}\` (**${spaces}** spaces, **${tabs}** tabs, **${mixed}** mixed)\n`;
  }
  result += `\n`;
  result += `<sub>*I am a bot; if you think this "alert" is a mistake, open an [issue](https://github.com/tabs-and-spaces-bot/my-source-code/issues) or contact @adri326*.</sub>\n`
  result += `<sub>*If you wish to disable this bot's scan of this repository, please comment with \`leave me alone\` or \`leave us alone\`.*</sub>`;
  return result;
}
