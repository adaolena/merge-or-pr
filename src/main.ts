import {  setFailed, warning } from "@actions/core";
import { getConfig } from "./get-config";
import { mergeOrPr } from "./merge-or-pr";

async function run() {
  try {
    warning('create pr')

    const config = getConfig();
    await mergeOrPr(config);
  } catch (error) {
    setFailed(error.message);
  }
}
run();
