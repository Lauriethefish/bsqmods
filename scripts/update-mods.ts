import { compareAlphabeticallyDesc } from "../shared/comparisonFunctions";
import { delay } from "../shared/delay";
import { fetchJson } from "../shared/fetch";
import { getIndentedMessage as indent } from "../shared/getIndentedMessage";
import { ghRegex } from "../shared/ghRegex";
import { IndentedConsoleLogger } from "../shared/IndentedConsoleLogger";
import { Message, Release, Releases } from "../shared/types/GitHubAPI";
import { importRemoteQmod } from "./import";
import { iterateSplitMods } from "./shared/iterateMods";

const mods = [...iterateSplitMods()].map(mod => mod.getModJson());
const repos = mods
  .map(mod => mod.download)
  .filter(link => link?.match(ghRegex))
  .map(link => {
    const match = ghRegex.exec(link as string) as RegExpExecArray

    return `${match[1]}/${match[2]}`.toLowerCase();
  })
  .filter((value, index, array) => array.indexOf(value) === index)
  .sort();

const links = mods
  .map(mod => mod.download)
  .filter(link => link?.match(ghRegex))
  .map(link => link?.toLowerCase())
  .filter((value, index, array) => array.indexOf(value) === index)
  .sort();

console.log("Running mod updater...\n");

repo_loop:
for (const [owner, repo] of repos.map(repo => repo.split("/"))) {
  console.log(`Processing ${owner}/${repo}`)

  const releases = (await fetchJson<Releases>(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`)).data;

  if (!releases) {
    console.error(indent("Release data is null\n", 1));
    continue;
  }

  if (releases instanceof Object && (releases as Message).message) {
    throw new Error((releases as Message).message);
  }

  release_loop:
  for (const release of (releases as Release[]).filter(release => !release.draft && !release.prerelease).sort((a, b) => compareAlphabeticallyDesc(a?.published_at, b?.published_at))) {
    console.log(indent(`Processing tag: ${release.tag_name}`, 1))

    let newLine = true;

    asset_loop:
    for (const asset of release.assets) {
      const url = asset.browser_download_url;

      if (!url.endsWith(".qmod")) {
        continue;
      }

      if (links.includes(url.toLowerCase())) {
        console.log(indent(`Tag found, moving to next repo.\n`, 2))
        newLine = false;
        break release_loop;
      }

      if (asset.name.toLowerCase().endsWith(".qmod")) {
        console.log(indent(`Processing asset: ${asset.name}\n`, 2))
        newLine = false;
        await importRemoteQmod(url, null, true, new IndentedConsoleLogger(3));
        links.push(url.toLowerCase())
      }
    }

    if (newLine) {
      console.log("");
    }
  }
}
