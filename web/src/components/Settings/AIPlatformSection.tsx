import { Button, Input, Modal, ModalDialog, Typography, DialogTitle, DialogContent, DialogActions, Divider, IconButton } from "@mui/joy";
import { PlusIcon, Trash2Icon, PencilIcon, BrainCircuitIcon, CircleOffIcon, AlertTriangleIcon, ServerIcon, KeyIcon, CheckCircle2Icon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { aiPlatformServiceClient } from "@/grpcweb";
import type { AIPlatform } from "@/types/proto/api/v1/ai_platform_service";
import { useTranslate } from "@/utils/i18n";

const AIPlatformSection = observer(() => {
  const t = useTranslate();
  const [aiPlatforms, setAiPlatforms] = useState<AIPlatform[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<AIPlatform | null>(null);
  const [platformFormData, setPlatformFormData] = useState({
    displayName: "",
    url: "",
    accessKey: "",
    description: "",
  });
  const [validationError, setValidationError] = useState<{ [key: string]: string | undefined }>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [platformToDelete, setPlatformToDelete] = useState<AIPlatform | null>(null);
  const [validatingPlatform, setValidatingPlatform] = useState<string | null>(null);

  useEffect(() => {
    fetchAIPlatforms();
  }, []);

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

  const handleCreateOrUpdatePlatform = async () => {
    // Validate form
    const errors: { [key: string]: string } = {};
    if (!platformFormData.displayName.trim()) {
      errors.displayName = t("common.required");
    }
    if (!platformFormData.url.trim()) {
      errors.url = t("common.required");
    }
    if (!platformFormData.accessKey.trim()) {
      errors.accessKey = t("common.required");
    }

    if (Object.keys(errors).length > 0) {
      setValidationError(errors);
      return;
    }

    setIsLoading(true);
    try {
      if (editingPlatform) {
        // Update existing platform
        console.debug("editingPlatform", editingPlatform);
        console.debug("platformFormData", platformFormData);
        await aiPlatformServiceClient.updateAIPlatform({
          platform: {
            name: editingPlatform.name,
            displayName: platformFormData.displayName,
            url: platformFormData.url,
            accessKey: platformFormData.accessKey,
            description: platformFormData.description,
          },
          updateMask: ["display_name", "url", "access_key", "description"],
        });
        toast.success(t("common.updated-successfully"));
      } else {
        // Create new platform
        await aiPlatformServiceClient.createAIPlatform({
          platform: {
            displayName: platformFormData.displayName,
            url: platformFormData.url,
            accessKey: platformFormData.accessKey,
            description: platformFormData.description,
          },
        });
        toast.success(t("common.created-successfully"));
      }

      await fetchAIPlatforms();
      setShowPlatformModal(false);
      resetForm();
    } catch (error) {
      console.error("Failed to save AI platform:", error);
      toast.error(t("common.save-error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePlatform = (platform: AIPlatform) => {
    setPlatformToDelete(platform);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!platformToDelete) return;

    setIsLoading(true);
    try {
      await aiPlatformServiceClient.deleteAIPlatform({
        name: platformToDelete.name,
      });

      toast.success(t("common.deleted-successfully"));
      await fetchAIPlatforms();
    } catch (error) {
      console.error("Failed to delete AI platform:", error);
      toast.error(t("common.delete-error"));
    } finally {
      setIsLoading(false);
      setDeleteConfirmOpen(false);
      setPlatformToDelete(null);
    }
  };

  const handleEditPlatform = (platform: AIPlatform) => {
    setEditingPlatform(platform);
    setPlatformFormData({
      displayName: platform.displayName,
      url: platform.url,
      accessKey: platform.accessKey,
      description: platform.description,
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
      displayName: "",
      url: "",
      accessKey: "",
      description: "",
    });
    setValidationError({});
  };

  const handleFormChange = (field: string, value: string) => {
    setPlatformFormData({
      ...platformFormData,
      [field]: value,
    });

    // Clear validation error for this field
    if (validationError[field]) {
      const newValidationErrors = { ...validationError };
      delete newValidationErrors[field];
      setValidationError(newValidationErrors);
    }
  };

  const handleValidatePlatform = async (platform: AIPlatform) => {
    setValidatingPlatform(platform.name);
    try {
      console.log("platform params", platform);
      const response = await fetch(platform.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${platform.accessKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "test" }]
        })
      });
      console.log("response", response);
      if (response.ok) {
        toast.success(t("ai.platform-validated") || "AI Platform validated successfully");
      } else {
        toast.error(t("ai.platform-validation-failed") || "Failed to validate AI Platform");
      }
    } catch (error) {
      console.error("Failed to validate AI platform:", error);
      toast.error(t("ai.platform-validation-error") || "Error validating AI Platform");
    } finally {
      setValidatingPlatform(null);
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
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">{t("ai-platform.table.url") || "URL"}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t("ai-platform.table.description") || "Description"}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">{t("common.action") || "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {aiPlatforms.map((platform) => (
                <tr key={platform.name} className="border-b border-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:border-zinc-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{platform.displayName}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono text-xs">{platform.url}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{platform.description || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-row justify-end items-center space-x-1">
                      <IconButton
                        size="sm"
                        variant="plain"
                        color="success"
                        onClick={() => handleValidatePlatform(platform)}
                        loading={validatingPlatform === platform.name}
                        title={t("ai.validate-platform") || "Validate Platform"}
                      >
                        <CheckCircle2Icon className="w-4 h-4" />
                      </IconButton>
                      <IconButton
                        size="sm"
                        variant="plain"
                        color="neutral"
                        onClick={() => handleEditPlatform(platform)}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </IconButton>
                      <IconButton
                        size="sm"
                        variant="plain"
                        color="danger"
                        onClick={() => handleDeletePlatform(platform)}
                      >
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
            </div>
          </DialogContent>
          <DialogActions>
            <Button size="sm" variant="plain" color="neutral" onClick={() => setShowPlatformModal(false)}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button size="sm" variant="solid" color="primary" loading={isLoading} onClick={handleCreateOrUpdatePlatform}>
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
            <Button size="sm" variant="solid" color="danger" onClick={confirmDelete} loading={isLoading}>
              {t("common.delete") || "Delete"}
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </div>
  );
});

export default AIPlatformSection;
