import { Button, Input, Modal, ModalDialog, Typography, DialogTitle, DialogContent, DialogActions } from "@mui/joy";
import {
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  BrainCircuitIcon,
  CircleOffIcon,
  AlertTriangleIcon,
  SaveIcon,
  XIcon,
  ServerIcon,
  KeyIcon,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslate } from "@/utils/i18n";

// AI平台接口定义
interface AIPlatform {
  id: string;
  url: string;
  accessKey: string;
  name: string;
  description?: string;
}

const AIPlatformSection = observer(() => {
  const t = useTranslate();
  const [aiPlatforms, setAiPlatforms] = useState<AIPlatform[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<AIPlatform | null>(null);
  const [platformFormData, setPlatformFormData] = useState({
    name: "",
    url: "",
    accessKey: "",
    description: "",
  });
  const [validationError, setValidationError] = useState<{ [key: string]: string | undefined }>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [platformToDelete, setPlatformToDelete] = useState<AIPlatform | null>(null);

  useEffect(() => {
    fetchAIPlatforms();
  }, []);

  const fetchAIPlatforms = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/ai-platforms");
      if (!response.ok) {
        throw new Error("Failed to fetch AI platforms");
      }
      const data = await response.json();
      setAiPlatforms(data);
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
    if (!platformFormData.name.trim()) {
      errors.name = t("common.required");
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
      const isEditing = Boolean(editingPlatform);
      const endpoint = isEditing ? `/api/ai-platforms/${editingPlatform?.id}` : "/api/ai-platforms";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(platformFormData),
      });

      if (!response.ok) {
        throw new Error(isEditing ? "Failed to update AI platform" : "Failed to create AI platform");
      }

      toast.success(isEditing ? t("common.updated-successfully") : t("common.created-successfully"));
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
      const response = await fetch(`/api/ai-platforms/${platformToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete AI platform");
      }

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
      name: platform.name,
      url: platform.url,
      accessKey: platform.accessKey,
      description: platform.description || "",
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
      name: "",
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

  return (
    <div className="w-full flex flex-col justify-start items-start">
      <div className="w-full flex flex-row justify-between items-center mb-4">
        <div>
          <Typography className="text-xl font-medium">{t("setting.ai-platform-section.title") || "AI Platforms"}</Typography>
          <Typography className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t("setting.ai-platform-section.description") || "Manage and configure AI platforms for your workspace"}
          </Typography>
        </div>
        <div>
          <Button variant="solid" color="primary" startDecorator={<PlusIcon className="w-4 h-4" />} onClick={handleAddPlatform}>
            {t("common.add")}
          </Button>
        </div>
      </div>

      {isLoading && aiPlatforms.length === 0 ? (
        <div className="w-full py-6 flex flex-row justify-center items-center">
          <p className="text-gray-400 dark:text-gray-500">{t("common.loading") || "Loading..."}</p>
        </div>
      ) : aiPlatforms.length === 0 ? (
        <div className="w-full py-8 flex flex-col justify-center items-center border border-dashed rounded-lg">
          <CircleOffIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
          <p className="mt-2 text-gray-400 dark:text-gray-500">{t("ai-platform.empty-list") || "No AI platforms configured yet"}</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full border-spacing-0 border-separate">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-sm font-normal text-gray-500 dark:text-gray-400">{t("ai-platform.table.name")}</th>
                <th className="px-3 py-2 text-left text-sm font-normal text-gray-500 dark:text-gray-400">{t("ai-platform.table.url")}</th>
                <th className="px-3 py-2 text-left text-sm font-normal text-gray-500 dark:text-gray-400">
                  {t("ai-platform.table.description")}
                </th>
                <th className="px-3 py-2 text-right text-sm font-normal text-gray-500 dark:text-gray-400">{t("common.action")}</th>
              </tr>
            </thead>
            <tbody>
              {aiPlatforms.map((platform) => (
                <tr key={platform.id} className="hover:bg-gray-50 dark:hover:bg-zinc-700">
                  <td className="px-3 py-2 text-left text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{platform.name}</span>
                  </td>
                  <td className="px-3 py-2 text-left text-sm">
                    <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">{platform.url}</span>
                  </td>
                  <td className="px-3 py-2 text-left text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{platform.description || "-"}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-row justify-end items-center space-x-1">
                      <Button
                        variant="plain"
                        size="sm"
                        color="neutral"
                        onClick={() => handleEditPlatform(platform)}
                        startDecorator={<PencilIcon className="w-4 h-4" />}
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        variant="plain"
                        size="sm"
                        color="danger"
                        onClick={() => handleDeletePlatform(platform)}
                        startDecorator={<Trash2Icon className="w-4 h-4" />}
                      >
                        {t("common.delete")}
                      </Button>
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
        <ModalDialog aria-labelledby="platform-modal-title" aria-describedby="platform-modal-description" sx={{ maxWidth: 500 }}>
          <div className="flex items-center mb-2">
            <BrainCircuitIcon className="w-6 h-6 text-primary mr-2" />
            <Typography id="platform-modal-title" component="h2" level="h4" className="font-medium">
              {editingPlatform ? t("ai-platform.edit-title") || "Edit AI Platform" : t("ai-platform.add-title") || "Add AI Platform"}
            </Typography>
          </div>
          <Typography id="platform-modal-description" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("ai-platform.modal-description") || "Configure the connection details for the AI platform"}
          </Typography>

          <div className="mt-4 space-y-4">
            <div>
              <Typography className="mb-1 text-sm font-medium">{t("ai-platform.form.name") || "Name"} *</Typography>
              <Input
                fullWidth
                value={platformFormData.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                error={!!validationError.name}
                placeholder={t("ai-platform.form.name-placeholder") || "e.g. OpenAI"}
              />
              {validationError.name && <Typography className="mt-1 text-xs text-red-500">{validationError.name}</Typography>}
            </div>

            <div>
              <Typography className="mb-1 text-sm font-medium">
                <div className="flex items-center">
                  <ServerIcon className="w-4 h-4 mr-1 text-gray-500" />
                  {t("ai-platform.form.url") || "URL"} *
                </div>
              </Typography>
              <Input
                fullWidth
                value={platformFormData.url}
                onChange={(e) => handleFormChange("url", e.target.value)}
                error={!!validationError.url}
                placeholder={t("ai-platform.form.url-placeholder") || "https://api.example.com/v1"}
              />
              {validationError.url && <Typography className="mt-1 text-xs text-red-500">{validationError.url}</Typography>}
            </div>

            <div>
              <Typography className="mb-1 text-sm font-medium">
                <div className="flex items-center">
                  <KeyIcon className="w-4 h-4 mr-1 text-gray-500" />
                  {t("ai-platform.form.access-key") || "Access Key"} *
                </div>
              </Typography>
              <Input
                fullWidth
                type="password"
                value={platformFormData.accessKey}
                onChange={(e) => handleFormChange("accessKey", e.target.value)}
                error={!!validationError.accessKey}
                placeholder={t("ai-platform.form.access-key-placeholder") || "Enter API access key"}
              />
              {validationError.accessKey && <Typography className="mt-1 text-xs text-red-500">{validationError.accessKey}</Typography>}
            </div>

            <div>
              <Typography className="mb-1 text-sm font-medium">{t("ai-platform.form.description") || "Description"}</Typography>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <Button
                variant="plain"
                color="neutral"
                onClick={() => setShowPlatformModal(false)}
                startDecorator={<XIcon className="w-4 h-4" />}
              >
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button
                variant="solid"
                color="primary"
                loading={isLoading}
                onClick={handleCreateOrUpdatePlatform}
                startDecorator={<SaveIcon className="w-4 h-4" />}
              >
                {editingPlatform ? t("common.save") || "Save" : t("common.create") || "Create"}
              </Button>
            </div>
          </div>
        </ModalDialog>
      </Modal>

      {/* 删除确认对话框 */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <ModalDialog variant="outlined" color="danger">
          <DialogTitle>
            <div className="flex items-center">
              <AlertTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
              {t("common.delete-confirm") || "Confirm deletion"}
            </div>
          </DialogTitle>
          <DialogContent>
            {platformToDelete && (
              <Typography>
                {t("ai-platform.delete-confirm-text", { name: platformToDelete.name }) ||
                  `Are you sure you want to delete the platform "${platformToDelete.name}"?`}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setDeleteConfirmOpen(false)}
              startDecorator={<XIcon className="w-4 h-4" />}
            >
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button
              variant="solid"
              color="danger"
              onClick={confirmDelete}
              loading={isLoading}
              startDecorator={<Trash2Icon className="w-4 h-4" />}
            >
              {t("common.delete") || "Delete"}
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </div>
  );
});

export default AIPlatformSection;
