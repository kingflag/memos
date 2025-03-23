import { Dropdown, Menu, MenuButton, List, ListItem, ListItemButton } from "@mui/joy";
import { Button } from "@usememos/mui";
import { BrainCircuitIcon, CircleOffIcon, LoaderIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import useClickAway from "react-use/lib/useClickAway";
import { aiPlatformServiceClient } from "@/grpcweb";
import { useTranslate } from "@/utils/i18n";
import { EditorRefActions } from "../Editor";
import toast from "react-hot-toast";
import type { AIPlatform } from "@/types/proto/api/v1/ai_platform_service";

interface Props {
  editorRef: React.RefObject<EditorRefActions>;
}

const AgentIntegrateOption = observer((props: Props) => {
  console.debug(props);
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [aiPlatforms, setAiPlatforms] = useState<AIPlatform[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  useClickAway(containerRef, () => {
    setOpen(false);
  });

  useEffect(() => {
    if (open) {
      fetchAIPlatforms();
    }
  }, [open]);

  const fetchAIPlatforms = async () => {
    setIsLoading(true);
    try {
      const response = await aiPlatformServiceClient.listAIPlatforms({});
      setAiPlatforms(response.platforms);
    } catch (error) {
      console.error("Failed to fetch AI platforms:", error);
      toast.error(t("common.fetch-error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlatform = (platformName: string) => {
    setSelectedPlatform(platformName);
    // 这里可以添加选择平台后的操作，比如通知编辑器
    setOpen(false);
  };

  return (
    <Dropdown open={open} onOpenChange={(_, isOpen) => setOpen(isOpen)}>
      <MenuButton slots={{ root: "div" }}>
        <Button size="sm" variant="plain" title={selectedPlatform || t("ai.select-platform") || "Select AI Platform"}>
          <BrainCircuitIcon className="w-5 h-5 mx-auto" />
        </Button>
      </MenuButton>
      <Menu className="relative" component="div" size="sm" placement="bottom-start">
        <div ref={containerRef} className="p-1 min-w-[220px]">
          <div className="flex justify-between items-center px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium">{t("ai.platforms") || "AI Platforms"}</h3>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-4">
              <LoaderIcon className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : aiPlatforms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 px-2">
              <CircleOffIcon className="w-6 h-6 text-gray-400 mb-1" />
              <p className="text-xs text-gray-500 text-center">{t("ai-platform.empty-list") || "No AI platforms configured yet"}</p>
            </div>
          ) : (
            <List
              size="sm"
              sx={{
                "--ListItem-minHeight": "32px",
                "--ListItemDecorator-size": "28px",
              }}
            >
              {aiPlatforms.map((platform) => (
                <ListItem key={platform.name}>
                  <ListItemButton
                    onClick={() => handleSelectPlatform(platform.displayName)}
                    selected={selectedPlatform === platform.displayName}
                  >
                    {platform.displayName}
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}

          {!isLoading && aiPlatforms.length > 0 && (
            <div className="mt-1 pt-1 border-t border-gray-100 dark:border-gray-700 px-2 py-1">
              <p className="text-xs text-gray-500">{t("ai.select-platform-hint") || "Select an AI platform to use"}</p>
            </div>
          )}
        </div>
      </Menu>
    </Dropdown>
  );
});

export default AgentIntegrateOption;
