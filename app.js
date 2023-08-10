require('dotenv').config();

const packageInfo = require('./package.json');
core.info(`Starting ${packageInfo.name}`);

const helpers = require('./helpers');
const uniq = require('lodash.uniq');

//require octokit rest.js
//more info at https://github.com/octokit/rest.js
const github = require('@actions/github');
const core = require('@actions/core');
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
      const existingLabels = await helpers.listLabelsOnIssue(octokit, eventOwner, eventRepo, eventIssueNumber);
      core.debug('existing labels', exitingLabels);

      //get monorepo repo for each file
      prFilesRepos = prFiles.map(({ filename }) => helpers.getMonorepo(baseDirectories, filename));

      //reduce to unique repos
      const prFilesReposUnique = uniq(prFilesRepos);

      //remove unaffected repos, and add label for each monorepo repo
      //add label for each monorepo repo
      existingLabels.forEach((label) => {
        if (prFilesReposUnique.indexOf(label.name) > -1) {
          const repoLabel = helpers.getLabel(repo);
          core.info(`labeling repo: ${repoLabel}`);

          helpers.addLabel(octokit, eventOwner, eventRepo, eventIssueNumber, repoLabel);
        } else {
          core.info(`removing label ${label.name}`);
          helpers.removeLabel(octokit, eventOwner, eventRepo, eventIssueNumber, label.name);
        }
      });
    }
  } catch (error) {
    core.setFailed(error);
  }
}

//run the function
prMonorepoRepoLabeler().catch(console.error);

module.exports.prMonorepoRepoLabeler = prMonorepoRepoLabeler;
