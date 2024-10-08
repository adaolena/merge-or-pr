import { debug, setOutput, warning } from "@actions/core";
import { getOctokit } from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
import { Config } from "./types";

export async function mergeOrPr(config: Config) {
  const octokit = getOctokit(config.repoToken);
  await createPr(octokit, config);
  setOutput("PR_CREATED", false);
  await tryMerge(octokit, config)

}

async function tryMerge(
  octokit: InstanceType<typeof GitHub>,
  {
    repoName: repo,
    repoOwner: owner,
    targetBranch: head,
    mergeBranchName: base,
  }: Config
): Promise<boolean> {
  try {
    warning( `merge "${head}" on "${base}" `)
    await octokit.rest.repos.merge({
      repo,
      owner,
      base,
      head,
    });
    return true;
  } catch (error) {
    const expectedConflictMessage = "Merge conflict";
    if (error.name !== "HttpError" || error.status !== 409) {
      throw Error(error);
    }

    debug(`API returned conflict: "${error}"`);
    if (error.message !== expectedConflictMessage) {
        warning(`Unexpected conflict message was returned from Github API: "${error.message}", please ensure you're using token that can push to protected branch`)
    }
    return false;
  }
}

async function createPr(octokit: InstanceType<typeof GitHub>, config: Config) {
  const branchRef = `refs/heads/${config.prConfig.mergeBranchName}`;
  const prConfig = config.prConfig;
  await octokit.rest.git.createRef({
    repo: config.repoName,
    owner: config.repoOwner,
    sha: config.headToMerge,
    ref: branchRef,
  });
  warning( `created ref "${branchRef}" `)

  const pr = await octokit.rest.pulls.create({
    repo: config.repoName,
    owner: config.repoOwner,
    head: branchRef,
    title: prConfig.title,
    body: prConfig.body,
    draft: prConfig.isDraft,
    maintainer_can_modify: prConfig.maintainerCanModify,
    base: config.targetBranch,
  });
  warning( `created pull request "${prConfig.title}" `)

    const assignedUser = prConfig.assignedUser;
    if (assignedUser && assignedUser !== "github-actions[bot]") {
      await octokit.rest.issues.addAssignees({
        repo: config.repoName,
        owner: config.repoOwner,
        issue_number: pr.data.number,
        assignees: [assignedUser],
      });
    }
    warning( `assigned user "${prConfig.title}" `)

    const reviewer = prConfig.reviewer;
    if (reviewer && reviewer !== "github-actions[bot]") {
      await octokit.rest.pulls.requestReviewers({
        repo: config.repoName,
        owner: config.repoOwner,
        pull_number: pr.data.number,
        reviewers: [reviewer],
      });
  }

  warning( ` reviewer "${prConfig.title}" `)


  setOutput("PR_CREATED", true);
  setOutput("PR_NUMBER", pr.data.number);
  setOutput("PR_MERGEABLE", pr.data.mergeable);
  setOutput("PR_URL", pr.data.html_url);
  setOutput("MERGE_BRANCH_NAME", config.prConfig.mergeBranchName);
}
