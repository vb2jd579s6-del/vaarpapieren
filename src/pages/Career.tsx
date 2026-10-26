import { useState } from "react";
import { SeaTime } from "../components/SeaTime";
import { SegmentedControl } from "../components/SegmentedControl";
import { t } from "../i18n";

type Section = "seaTime" | "requirements";

/** Sea time and the certificates a role needs. */
export function Career() {
  const [section, setSection] = useState<Section>("seaTime");
  return (
    <div className="career">
      <div className="career-head">
        <h2>{t.tabs.career}</h2>
        <SegmentedControl
          label={t.tabs.career}
          value={section}
          onChange={setSection}
          segments={[
            { id: "seaTime", label: t.career.seaTime },
            { id: "requirements", label: t.career.requirements },
          ]}
        />
      </div>
      {section === "seaTime" && <SeaTime />}
    </div>
  );
}
