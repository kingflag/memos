import { Button, Input, Modal, ModalDialog, Typography, DialogTitle, DialogContent, DialogActions, Divider, IconButton, Select, Option } from "@mui/joy";
import {
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  BrainCircuitIcon,
  CircleOffIcon,
  AlertTriangleIcon,
  ServerIcon,
  KeyIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { aiPlatformServiceClient } from "@/grpcweb";
import type { AIPlatform } from "@/types/proto/api/v1/ai_platform_service";
import { useTranslate } from "@/utils/i18n";
import { PlatformType } from "@/types/proto/api/v1/ai_platform_service";
import { FieldMask } from "@/types/proto/google/protobuf/field_mask";

const AIPlatformSection = observer(() => {
  const t = useTranslate();
  const [aiPlatforms, setAiPlatforms] = useState<AIPlatform[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<AIPlatform | null>(null);
  const [platformFormData, setPlatformFormData] = useState<{
    platformType: PlatformType;
    url: string;
    accessKey: string;
    displayName: string;
    description: string;
    model: string;
  }>({
    platformType: PlatformType.UNSPECIFIED,
    url: "",
    accessKey: "",
    displayName: "",
    description: "",
    model: "",
  });
  const [validationError, setValidationError] = useState<{ [key: string]: string | undefined }>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [platformToDelete, setPlatformToDelete] = useState<AIPlatform | null>(null);
  const [validatingPlatform, setValidatingPlatform] = useState<number | null>(null);
  const [platformValidationStatus, setPlatformValidationStatus] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchAIPlatforms();
  }, []);

  const fetchAIPlatforms = async () => {
    setIsLoading(true);
    try {
      const response = await aiPlatformServiceClient.listAIPlatforms({});
      console.debug("AI Platforms response:", response);
      setAiPlatforms(response.platforms);
    } catch (error) {
      console.error("Failed to fetch AI platforms:", error);
      toast.error(t("common.fetch-error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlatform = async () => {
    try {
      const response = await aiPlatformServiceClient.createAIPlatform({
        platform: {
          platformType: platformFormData.platformType,
          url: platformFormData.url,
          accessKey: platformFormData.accessKey,
          displayName: platformFormData.displayName,
          description: platformFormData.description,
          model: platformFormData.model,
        },
      });
      toast.success(t("ai.platform-created") || "Platform created successfully");
      setShowPlatformModal(false);
      resetForm();
      fetchAIPlatforms();
    } catch (error) {
      console.error("Failed to create platform:", error);
      toast.error(t("ai.platform-create-failed") || "Failed to create platform");
    }
  };

  const handleUpdatePlatform = async () => {
    if (!editingPlatform) return;
    console.log("Updating platform with data:", platformFormData);

    try {
      const response = await aiPlatformServiceClient.updateAIPlatform({
        platform: {
          id: editingPlatform.id,
          platformType: platformFormData.platformType,
          url: platformFormData.url,
          accessKey: platformFormData.accessKey,
          displayName: platformFormData.displayName,
          description: platformFormData.description,
          model: platformFormData.model,
        },
        updateMask: undefined,
      });
      console.log("Update platform response:", response);
      toast.success(t("ai.platform-updated") || "Platform updated successfully");
      setShowPlatformModal(false);
      setEditingPlatform(null);
      resetForm();
      fetchAIPlatforms();
    } catch (error) {
      console.error("Failed to update platform:", error);
      toast.error(t("ai.platform-update-failed") || "Failed to update platform");
    }
  };

  const handleDeletePlatform = async (platform: AIPlatform) => {
    try {
      await aiPlatformServiceClient.deleteAIPlatform({
        id: platform.id,
      });
      toast.success(t("ai.platform-deleted") || "Platform deleted successfully");
      fetchAIPlatforms();
    } catch (error) {
      console.error("Failed to delete platform:", error);
      toast.error(t("ai.platform-delete-failed") || "Failed to delete platform");
    }
  };

  const handleEditPlatform = (platform: AIPlatform) => {
    console.log("Editing platform:", platform);
    setEditingPlatform(platform);
    setPlatformFormData({
      platformType: platform.platformType,
      url: platform.url,
      accessKey: platform.accessKey,
      displayName: platform.displayName,
      description: platform.description,
      model: platform.model,
    });
    setShowPlatformModal(true);
  };

  const handleAddPlatform = () => {
    resetForm();
    setEditingPlatform(null);
    setShowPlatformModal(true);
  };

  const resetForm = () => {
    setPlatformFormData({
      platformType: PlatformType.UNSPECIFIED,
      url: "",
      accessKey: "",
      displayName: "",
      description: "",
      model: "",
    });
    setValidationError({});
  };

  const handleFormChange = (field: keyof typeof platformFormData, value: any) => {
    setPlatformFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear validation error for this field
    if (validationError[field]) {
      const newValidationErrors = { ...validationError };
      delete newValidationErrors[field];
      setValidationError(newValidationErrors);
    }
  };

  const handleValidatePlatform = async (platform: AIPlatform) => {
    setValidatingPlatform(platform.id);
    try {
      const response = await aiPlatformServiceClient.generateAnswer({
        id: platform.id,
        prompt: "Hello",
      });
      setPlatformValidationStatus({
        ...platformValidationStatus,
        [platform.id]: response.success,
      });
    } catch (error) {
      console.error("Failed to validate platform:", error);
      setPlatformValidationStatus({
        ...platformValidationStatus,
        [platform.id]: false,
      });
    } finally {
      setValidatingPlatform(null);
    }
  };

  const getPlatformTypeLabel = (type: PlatformType) => {
    switch (type) {
      case PlatformType.OLLAMA:
        return "Ollama";
      case PlatformType.DEEPSEEK:
        return "DeepSeek";
      case PlatformType.UNSPECIFIED:
        return t("common.unspecified") || "Unspecified";
      default:
        return t("common.unknown") || "Unknown";
    }
  };

  return (
    <div className="w-full flex flex-col justify-start items-start">
      <div className="w-full flex flex-row justify-between items-center mb-2">
        <div>
          <Typography className="text-xl font-medium">{t("setting.ai-platform-section.title") || "AI Platforms"}</Typography>
          <Typography level="body-sm" className="text-gray-500 mt-1">
            {t("setting.ai-platform-section.description") || "Manage and configure AI platforms for your workspace"}
          </Typography>
        </div>
        <div>
          <Button variant="outlined" color="neutral" startDecorator={<PlusIcon className="w-4 h-4" />} onClick={handleAddPlatform}>
            {t("common.add")}
          </Button>
        </div>
      </div>

      <Divider className="mt-2 mb-3" />

      {isLoading && aiPlatforms.length === 0 ? (
        <div className="w-full py-6 flex flex-row justify-center items-center">
          <p className="text-gray-400">{t("common.loading") || "Loading..."}</p>
        </div>
      ) : aiPlatforms.length === 0 ? (
        <div className="w-full py-8 flex flex-col justify-center items-center border border-dashed rounded-lg">
          <CircleOffIcon className="w-12 h-12 text-gray-400" />
          <p className="mt-2 text-gray-400">{t("ai-platform.empty-list") || "No AI platforms configured yet"}</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">{t("ai-platform.table.name") || "Name"}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">{t("ai-platform.table.platform-type") || "Platform Type"}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">{t("ai-platform.table.url") || "URL"}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">{t("ai-platform.table.model") || "Model"}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t("ai-platform.table.description") || "Description"}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">{t("common.action") || "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {aiPlatforms.map((platform) => (
                <tr key={platform.id} className="border-b border-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:border-zinc-700">
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <span className="font-medium">{platform.displayName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{getPlatformTypeLabel(platform.platformType)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="plain"
                        color={
                          platformValidationStatus[platform.id] === undefined
                            ? "neutral"
                            : platformValidationStatus[platform.id]
                              ? "success"
                              : "danger"
                        }
                        onClick={() => handleValidatePlatform(platform)}
                        loading={validatingPlatform === platform.id}
                        disabled={
                          platformValidationStatus[platform.id] === undefined
                            ? false
                            : platformValidationStatus[platform.id]
                        }
                      >
                        {platformValidationStatus[platform.id] === undefined ? (
                          t("ai.validate") || "Validate"
                        ) : platformValidationStatus[platform.id] ? (
                          t("ai.valid") || "Valid"
                        ) : (
                          t("ai.invalid") || "Invalid"
                        )}
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{platform.model}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">{platform.description}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end space-x-2">
                      <IconButton size="sm" variant="plain" color="neutral" onClick={() => handleEditPlatform(platform)}>
                        <PencilIcon className="w-4 h-4" />
                      </IconButton>
                      <IconButton size="sm" variant="plain" color="danger" onClick={() => handleDeletePlatform(platform)}>
                        <Trash2Icon className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Platform Modal */}
      <Modal open={showPlatformModal} onClose={() => setShowPlatformModal(false)}>
        <ModalDialog aria-labelledby="platform-modal-title" aria-describedby="platform-modal-description" size="md">
          <DialogTitle>
            <div className="flex items-center">
              <BrainCircuitIcon className="w-5 h-5 mr-2 text-primary" />
              {editingPlatform ? t("ai-platform.edit-title") || "Edit AI Platform" : t("ai-platform.add-title") || "Add AI Platform"}
            </div>
          </DialogTitle>
          <Divider />
          <DialogContent>
            <div className="mt-2 space-y-4">
              <div>
                <Typography level="body-sm" className="mb-1 font-medium">
                  {t("ai-platform.form.type") || "Platform Type"} *
                </Typography>
                <Select
                  size="sm"
                  value={platformFormData.platformType}
                  onChange={(_, value) => handleFormChange("platformType", value)}
                >
                  <Option value={PlatformType.UNSPECIFIED}>Select a platform type</Option>
                  <Option value={PlatformType.OLLAMA}>Ollama</Option>
                  <Option value={PlatformType.DEEPSEEK}>DeepSeek</Option>
                </Select>
              </div>

              <div>
                <Typography level="body-sm" className="mb-1 font-medium">
                  {t("ai-platform.form.name") || "Display Name"} *
                </Typography>
                <Input
                  size="sm"
                  fullWidth
                  value={platformFormData.displayName}
                  onChange={(e) => handleFormChange("displayName", e.target.value)}
                  error={!!validationError.displayName}
                  placeholder={t("ai-platform.form.name-placeholder") || "e.g. OpenAI"}
                />
                {validationError.displayName && (
                  <Typography level="body-xs" className="mt-1 text-danger">
                    {validationError.displayName}
                  </Typography>
                )}
              </div>

              <div>
                <Typography level="body-sm" className="mb-1 font-medium">
                  {t("ai-platform.form.url") || "URL"} *
                  <span className="inline-flex items-center ml-1">
                    <ServerIcon className="w-4 h-4 text-gray-500" />
                  </span>
                </Typography>
                <Input
                  size="sm"
                  fullWidth
                  value={platformFormData.url}
                  onChange={(e) => handleFormChange("url", e.target.value)}
                  error={!!validationError.url}
                  placeholder={t("ai-platform.form.url-placeholder") || "https://api.example.com/v1"}
                />
                {validationError.url && (
                  <Typography level="body-xs" className="mt-1 text-danger">
                    {validationError.url}
                  </Typography>
                )}
              </div>

              <div>
                <Typography level="body-sm" className="mb-1 font-medium">
                  {t("ai-platform.form.access-key") || "Access Key"} *
                  <span className="inline-flex items-center ml-1">
                    <KeyIcon className="w-4 h-4 text-gray-500" />
                  </span>
                </Typography>
                <Input
                  size="sm"
                  fullWidth
                  type="password"
                  value={platformFormData.accessKey}
                  onChange={(e) => handleFormChange("accessKey", e.target.value)}
                  error={!!validationError.accessKey}
                  placeholder={t("ai-platform.form.access-key-placeholder") || "Enter API access key"}
                />
                {validationError.accessKey && (
                  <Typography level="body-xs" className="mt-1 text-danger">
                    {validationError.accessKey}
                  </Typography>
                )}
              </div>

              <div>
                <Typography level="body-sm" className="mb-1 font-medium">
                  {t("ai-platform.form.description") || "Description"}
                </Typography>
                <Input
                  size="sm"
                  fullWidth
                  value={platformFormData.description}
                  onChange={(e) => handleFormChange("description", e.target.value)}
                  placeholder={t("ai-platform.form.description-placeholder") || "Optional description of this platform"}
                />
              </div>

              <div>
                <Typography level="body-sm" className="mb-1 font-medium">
                  {t("ai-platform.form.model") || "Model"} *
                </Typography>
                <Input
                  size="sm"
                  fullWidth
                  value={platformFormData.model}
                  onChange={(e) => handleFormChange("model", e.target.value)}
                  error={!!validationError.model}
                  placeholder={t("ai-platform.form.model-placeholder") || "e.g. deepseek-coder"}
                />
                {validationError.model && (
                  <Typography level="body-xs" className="mt-1 text-danger">
                    {validationError.model}
                  </Typography>
                )}
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <Button size="sm" variant="plain" color="neutral" onClick={() => setShowPlatformModal(false)}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button size="sm" variant="solid" color="primary" loading={isLoading} onClick={editingPlatform ? handleUpdatePlatform : handleCreatePlatform}>
              {editingPlatform ? t("common.save") || "Save" : t("common.create") || "Create"}
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <ModalDialog variant="outlined" color="danger" size="sm">
          <DialogTitle>
            <div className="flex items-center">
              <AlertTriangleIcon className="w-5 h-5 text-danger mr-2" />
              {t("common.delete-confirm") || "Confirm deletion"}
            </div>
          </DialogTitle>
          <Divider />
          <DialogContent>
            {platformToDelete && (
              <Typography level="body-sm" className="mt-1">
                {t("ai-platform.delete-confirm-text", { name: platformToDelete.displayName }) ||
                  `Are you sure you want to delete the platform "${platformToDelete.displayName}"?`}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button size="sm" variant="plain" color="neutral" onClick={() => setDeleteConfirmOpen(false)}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button size="sm" variant="solid" color="danger" onClick={() => handleDeletePlatform(platformToDelete!)} loading={isLoading}>
              {t("common.delete") || "Delete"}
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </div>
  );
});

export default AIPlatformSection;
