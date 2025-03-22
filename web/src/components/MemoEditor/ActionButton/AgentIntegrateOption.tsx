import { Dropdown, Menu, MenuButton } from "@mui/joy";
import { Button } from "@usememos/mui";
import { BrainCircuitIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRef, useState } from "react";
import useClickAway from "react-use/lib/useClickAway";
import { useTranslate } from "@/utils/i18n";
import { EditorRefActions } from "../Editor";

interface Props {
  editorRef: React.RefObject<EditorRefActions>;
}

const AgentIntegrateOption = observer((props: Props) => {
  console.debug(props);
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickAway(containerRef, () => {
    setOpen(false);
  });

  return (
    <Dropdown open={open} onOpenChange={(_, isOpen) => setOpen(isOpen)}>
      <MenuButton slots={{ root: "div" }}>
        <Button size="sm" variant="plain" title={t("ai.select-platform") || "Select AI Platform"}>
          <BrainCircuitIcon className="w-5 h-5 mx-auto" />
        </Button>
      </MenuButton>
      <Menu className="relative" component="div" size="sm" placement="bottom-start">
        <div ref={containerRef} className="p-1">
          <div className="flex justify-between items-center px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium">{t("ai.platforms") || "AI Platforms"}</h3>
          </div>
          <p className="italic mx-2 my-2 text-gray-500 dark:text-gray-400">
            {t("ai.feature-not-available") || "AI Platform feature is not yet implemented"}
          </p>
        </div>
      </Menu>
    </Dropdown>
  );
});

export default AgentIntegrateOption;
