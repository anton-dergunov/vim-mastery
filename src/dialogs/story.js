/* The story dialog: the intro, unit endings, and the finale.
 */

import { appUrl } from "../app/version.js";
import { StoryTransitions } from "../world/story-transitions.js";
import { catalogData, elements, unit, units, urlParams } from "../app/context.js";
import { navigateToUnit } from "../app/navigation.js";
import { openTableOfContents, renderTableOfContents } from "./contents.js";
import { showOpeningReference } from "./entry-level.js";

// A default arrival: no art review, no deep link into an activity, no jump into
// a later unit. The story intro and the opening deck share it, so neither one
// interrupts someone who asked for a specific screen.
export const isDefaultArrival = !urlParams.has("preview")
  && !urlParams.has("reference")
  && !urlParams.has("practice")
  && !urlParams.has("activity")
  && (!urlParams.has("unit") || urlParams.get("unit") === units[0].id);

export const storyTransitions = new StoryTransitions({
  root: elements.storyDialog,
  presentation: catalogData.presentation,
  units,
  currentUnitId: unit.id,
  shouldShowIntro: isDefaultArrival,
  onNavigate: navigateToUnit,
  onOpenContents: openTableOfContents,
  onIntroFinished: ({ replay }) => {
    if (!replay) showOpeningReference();
  },
  onStateChange: renderTableOfContents,
  assetUrl: appUrl,
});
