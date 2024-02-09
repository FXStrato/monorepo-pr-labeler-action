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
      const prFilesReposUnique = uniq(prFilesRepos)
        .map((repo) => helpers.getLabel(repo))
        .filter(Boolean);

      /**
       * Things to check
       * if label in unique array exists in existing, splice out from existing labels array
       * if label in unique array does not exist in existing, addLabel to PR
       *
       */
      for (const repoLabel of prFilesReposUnique) {
        const labelIndex = existingLabels.findIndex((existing) => existing.name === repoLabel);
        if (labelIndex > -1) {
          existingLabels.splice(labelIndex, 1);
        } else {
          console.log(`labeling repo: ${repoLabel}`);
          helpers.addLabel(octokit, eventOwner, eventRepo, eventIssueNumber, repoLabel);
        }
      }

      /**
       * If existing labels array has anything left, means those are labels that were previously added that can be removed now.
       */
      if (existingLabels.length > 0) {
        for (const label of existingLabels) {
          // Don't remove the ephemeral label if it was included manually, as it is used for triggering ephemeral deploys
          if(label !== 'ephemeral') {
            console.log(`removing label ${label.name}`);
          helpers.removeLabel(octokit, eventOwner, eventRepo, eventIssueNumber, label.name);
          }
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
