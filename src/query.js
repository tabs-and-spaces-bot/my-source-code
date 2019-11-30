const fs = require("fs");
const path = require("path");
const settings = require("../settings.json")

const user_stack = [];

const query_repos_from_user = module.exports.repos_from_user = function query_repos_from_user(user) {
  return new Promise((resolve, reject) => {
    let user_query = client.getUser(user.login);
    user_query.listRepos({}, (err, repos) => {
      if (err) reject(err);
      resolve(
        repos.filter((repo) => new Date() - new Date(repo.updated_at) <= 3600000 * 24 * (settings.max_age || 7))
      );
    });
  });
}

const query_repos = module.exports.repos = function query_repos(users) {
  let promises = [];
  for (let user of users) {
    promises.push(query_repos_from_user(user));
  }
  return Promise.all(promises).then((repos) => [].concat(...repos));
}

const query_files = module.exports.files = function query_files(repo) {
  return new Promise((resolve, reject) => {
    let repo_query = client.getRepo(repo.owner.login, repo.name);
    repo_query.listBranches((err, branches) => {
      if (err) reject(err);
      if (!branches.length) resolve([]); // no file in the repo

      let master = branches.find(branch => branch.name === "master");
      if (!master) resolve(); // we only look into master
      repo_query.getCommit(master.commit.sha, (err, commit) => {
        if (err) reject(err);
        if (!commit) resolve([]);

        let files = [];
        let requests = 0;
        function get_tree(sha, path = "/") {
          requests++;
          repo_query.getTree(sha, (err, tree) => {
            if (err) reject(err);
            if (!tree) reject(new Error("No tree for commit " + commit.tree.sha));

            for (let file of tree.tree) {
              if (file.type === "blob") {
                files.push([file, path + file.path]);
              } else if (file.type === "tree") {
                get_tree(file.sha, path + file.path + "/");
              }
            }
            requests--;
            if (requests === 0) {
              resolve(files);
            }
          });
        }

        get_tree(commit.tree.sha);
      });
    });
  });
}

const query_file = module.exports.file = function query_file(repo, [file, path]) {
  return new Promise((resolve, reject) => {
    let repo_query = client.getRepo(repo.owner.login, repo.name);
    if (!repo_query) reject(new Error(`No repo named ${repo.owner.login}/${repo.name} found!`));
    repo_query.getBlob(file.sha, (err, data) => {
      if (err) reject(err);
      resolve(data);
    });
  });
}

const query_issues = module.exports.issues = function query_issues(repo) {
  let issues = client.getIssues(repo.owner.login, repo.name);
  return new Promise((resolve, reject) => {
    issues.listIssues({}, (err, res) => {
      if (err) reject(err);
      resolve(res);
    });
  });
}

const query_issue_comments = module.exports.issue_comments = function query_issue_comments(repo, issue_n) {
  let issues = client.getIssues(repo.owner.login, repo.name);
  return new Promise((resolve, reject) => {
    issues.listIssueComments(issue_n, (err, res) => {
      if (err) reject(err);
      resolve(res);
    });
  });
}
