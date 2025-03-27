import {
  Dropdown,
  Menu,
  MenuButton,
  List,
  ListItem,
  ListItemButton,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Textarea,
} from "@mui/joy";
import { Button as MuiButton } from "@usememos/mui";
import { BrainCircuitIcon, CircleOffIcon, LoaderIcon, SendIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import useClickAway from "react-use/lib/useClickAway";
import { aiPlatformServiceClient } from "@/grpcweb";
import type { AIPlatform } from "@/types/proto/api/v1/ai_platform_service";
import { useTranslate } from "@/utils/i18n";
import { EditorRefActions } from "../Editor";

interface Props {
  editorRef: React.RefObject<EditorRefActions>;
}

const AgentIntegrateOption = observer((props: Props) => {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [aiPlatforms, setAiPlatforms] = useState<AIPlatform[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<AIPlatform | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAnswer, setGeneratedAnswer] = useState<string>("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useClickAway(containerRef, () => {
    setOpen(false);
  });

  const resetState = () => {
    setPrompt("");
    setGeneratedAnswer("");
    setSelectedPlatform(null);
  };

  const handleClosePromptModal = () => {
    setShowPromptModal(false);
    resetState();
  };

  const handleClosePreviewModal = () => {
    setShowPreviewModal(false);
    resetState();
  };

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

  const handleSelectPlatform = (platform: AIPlatform) => {
    setSelectedPlatform(platform);
    setShowPromptModal(true);
    setOpen(false);
  };

  const handleGenerateAnswer = async () => {
    if (!selectedPlatform || !prompt.trim()) {
      toast.error(t("ai.prompt-required") || "Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await aiPlatformServiceClient.generateAnswer({
        name: selectedPlatform.name,
        prompt: prompt.trim(),
      });

      if (response.success) {
        setGeneratedAnswer(response.answer);
        setShowPreviewModal(true);
        setShowPromptModal(false);
      } else {
        toast.error(response.errorMessage || t("ai.generation-failed") || "Failed to generate answer");
      }
    } catch (error) {
      console.error("Failed to generate answer:", error);
      toast.error(t("ai.generation-error") || "Error generating answer");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmInsert = () => {
    if (props.editorRef.current) {
      const editor = props.editorRef.current;
      const currentContent = editor.getContent();
      const newContent = currentContent + "\n\n" + "> " + prompt + "\n\n" + generatedAnswer;
      editor.setContent(newContent);
    }
    toast.success(t("ai.answer-inserted") || "Answer inserted successfully");
    setShowPreviewModal(false);
    resetState();
  };

  return (
    <>
      <Dropdown open={open} onOpenChange={(_, isOpen) => setOpen(isOpen)}>
        <MenuButton slots={{ root: "div" }}>
          <MuiButton size="sm" variant="plain" title={selectedPlatform?.displayName || t("ai.select-platform") || "Select AI Platform"}>
            <BrainCircuitIcon className="w-5 h-5 mx-auto" />
          </MuiButton>
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
                    <ListItemButton onClick={() => handleSelectPlatform(platform)} selected={selectedPlatform?.name === platform.name}>
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

      {/* Prompt Modal */}
      <Modal open={showPromptModal} onClose={handleClosePromptModal}>
        <ModalDialog>
          <DialogTitle>
            <div className="flex items-center">
              <BrainCircuitIcon className="w-5 h-5 mr-2 text-primary" />
              {t("ai.generate-answer") || "Generate Answer"}
            </div>
          </DialogTitle>
          <DialogContent>
            <div className="mt-2">
              <Textarea
                minRows={3}
                placeholder={t("ai.enter-prompt") || "Enter your prompt..."}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating}
              />
            </div>
          </DialogContent>
          <DialogActions>
            <Button size="sm" variant="plain" color="neutral" onClick={handleClosePromptModal} disabled={isGenerating}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button
              size="sm"
              variant="solid"
              color="primary"
              onClick={handleGenerateAnswer}
              loading={isGenerating}
              startDecorator={<SendIcon className="w-4 h-4" />}
            >
              {t("ai.generate") || "Generate"}
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Preview Modal */}
      <Modal open={showPreviewModal} onClose={handleClosePreviewModal}>
        <ModalDialog size="lg">
          <DialogTitle>
            <div className="flex items-center">
              <BrainCircuitIcon className="w-5 h-5 mr-2 text-primary" />
              {t("ai.preview-answer") || "Preview Generated Answer"}
            </div>
          </DialogTitle>
          <DialogContent>
            <div className="mt-2">
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-1">{t("ai.prompt") || "Prompt"}</h4>
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md text-sm">{prompt}</div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">{t("ai.generated-answer") || "Generated Answer"}</h4>
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md text-sm whitespace-pre-wrap">{generatedAnswer}</div>
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <Button size="sm" variant="plain" color="neutral" onClick={handleClosePreviewModal}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button
              size="sm"
              variant="solid"
              color="primary"
              onClick={handleConfirmInsert}
              startDecorator={<SendIcon className="w-4 h-4" />}
            >
              {t("ai.insert-answer") || "Insert Answer"}
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </>
  );
});

export default AgentIntegrateOption;
