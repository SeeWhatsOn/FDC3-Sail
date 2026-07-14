import type { DirectoryApp } from "../app-directory/DirectoryInterface"
import { BasicDirectory } from "../app-directory/BasicDirectory"
import {
  fetchAppDirectory,
  loadLocalDirectoryData,
  mergeAppsWithoutDuplicates,
} from "../app-directory/fetch-app-directory"
import type { AppDirectorySource } from "../host-contracts/types"

/** Load and merge host-configured App Directory sources into a BasicDirectory. */
export async function loadDirectoryFromSources(
  sources: AppDirectorySource[] | undefined,
): Promise<{ directory: BasicDirectory; apps: DirectoryApp[] }> {
  let apps: DirectoryApp[] = []

  for (const source of sources ?? []) {
    if (source.type === "rest") {
      const fetched = await fetchAppDirectory(source.url)
      apps = mergeAppsWithoutDuplicates(apps, fetched)
    } else {
      const local = loadLocalDirectoryData(source.data)
      apps = mergeAppsWithoutDuplicates(apps, local)
    }
  }

  return { directory: new BasicDirectory(apps), apps }
}
