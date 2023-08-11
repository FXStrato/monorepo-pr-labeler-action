require('dotenv').config();

const packageInfo = require('./package.json');
console.log(`Starting ${packageInfo.name}`);

const helpers = require('./helpers');
const uniq = require('lodash.uniq');

//require octokit rest.js
//more info at https://github.com/octokit/rest.js
const github = require('@actions/github');
const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

let baseDirectories = '';
if (process.env.BASE_DIRS) baseDirectories = `(?:${process.env.BASE_DIRS})\/`;

//set eventOwner and eventRepo based on action's env variables
const eventOwnerAndRepo = process.env.GITHUB_REPOSITORY;
const eventOwner = helpers.getOwner(eventOwnerAndRepo);
const eventRepo = helpers.getRepo(eventOwnerAndRepo);

async function prMonorepoRepoLabeler() {
  try {
    //read contents of action's event.json
    const eventData = await helpers.readFilePromise(process.env.GITHUB_EVENT_PATH);

    if (eventData) {
      const eventJSON = JSON.parse(eventData);

      //set eventAction and eventIssueNumber
      eventAction = eventJSON.action;
      eventIssueNumber = eventJSON.pull_request.number;

      //get list of files in PR
      const prFiles = await helpers.listFiles(octokit, eventOwner, eventRepo, eventIssueNumber);

      //get list of labels currently on PR
      let { data: existingLabels } = await helpers.listLabelsOnIssue(octokit, eventOwner, eventRepo, eventIssueNumber);

      //get monorepo repo for each file
      prFilesRepos = prFiles.map(({ filename }) => helpers.getMonorepo(baseDirectories, filename));

      //reduce to unique repos
      const prFilesReposUnique = uniq(prFilesRepos).map((repo) => helpers.getLabel(repo));

      // add label if PR does not contain it, and remove labels for unaffected repos
      for (const label of existingLabels) {
        const labelIndex = prFilesReposUnique.indexOf(label.name);
        if (labelIndex > -1) {
          const repoLabel = prFilesReposUnique[labelIndex];
          console.log(`labeling repo: ${repoLabel}`);
          helpers.addLabel(octokit, eventOwner, eventRepo, eventIssueNumber, repoLabel);
        } else {
          console.log(`removing label ${label.name}`);
          helpers.removeLabel(octokit, eventOwner, eventRepo, eventIssueNumber, label.name);
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
}

//run the function
prMonorepoRepoLabeler().catch(console.error);

module.exports.prMonorepoRepoLabeler = prMonorepoRepoLabeler;
