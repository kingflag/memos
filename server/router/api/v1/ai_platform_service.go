package v1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	//"github.com/usememos/memos/server/resource"
	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) CreateAIPlatform(ctx context.Context, request *apiv1.CreateAIPlatformRequest) (*apiv1.AIPlatform, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}

	// 打印用户ID
	slog.Info("CreateAIPlatform called", "userID", user.ID)

	platform := request.GetPlatform()
	if platform == nil {
		return nil, status.Errorf(codes.InvalidArgument, "platform is empty")
	}

	// 验证必填字段
	if platform.Url == "" {
		return nil, status.Errorf(codes.InvalidArgument, "url is required")
	}
	if platform.AccessKey == "" {
		return nil, status.Errorf(codes.InvalidArgument, "access key is required")
	}
	if platform.DisplayName == "" {
		return nil, status.Errorf(codes.InvalidArgument, "display name is required")
	}
	if platform.Model == "" {
		return nil, status.Errorf(codes.InvalidArgument, "model is required")
	}

	// 创建存储模型
	create := &store.AIPlatform{
		URL:         platform.Url,
		AccessKey:   platform.AccessKey,
		DisplayName: platform.DisplayName,
		Description: platform.Description,
		Model:       platform.Model,
		CreatedTs:   time.Now().Unix(),
		UpdatedTs:   time.Now().Unix(),
	}

	aiPlatform, err := s.Store.CreateAIPlatform(ctx, create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create AI platform: %v", err)
	}

	return convertAIPlatformFromStore(aiPlatform), nil
}

func (s *APIV1Service) ListAIPlatforms(ctx context.Context, request *apiv1.ListAIPlatformsRequest) (*apiv1.ListAIPlatformsResponse, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}

	// 打印用户ID
	slog.Info("ListAIPlatforms called", "userID", user.ID)

	var limit, offset int
	if request.PageToken != "" {
		var pageToken apiv1.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = int(pageToken.Limit)
		offset = int(pageToken.Offset)
	} else {
		limit = int(request.PageSize)
	}
	if limit <= 0 {
		limit = DefaultPageSize
	}
	limitPlusOne := limit + 1

	// 实现分页支持，这里需要修改 ListAIPlatforms 方法
	aiPlatforms, err := s.Store.ListAIPlatforms(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list AI platforms: %v", err)
	}

	platforms := make([]*apiv1.AIPlatform, 0, len(aiPlatforms))
	nextPageToken := ""

	// 简单处理分页，实际上应该在数据库层面实现分页
	if len(aiPlatforms) > offset {
		end := offset + limitPlusOne
		if end > len(aiPlatforms) {
			end = len(aiPlatforms)
		}

		slicedPlatforms := aiPlatforms[offset:end]

		if len(slicedPlatforms) == limitPlusOne {
			slicedPlatforms = slicedPlatforms[:limit]
			nextPageToken, err = getPageToken(limit, offset+limit)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get next page token, error: %v", err)
			}
		}

		for _, p := range slicedPlatforms {
			platforms = append(platforms, convertAIPlatformFromStore(p))
		}
	}

	return &apiv1.ListAIPlatformsResponse{
		Platforms:     platforms,
		NextPageToken: nextPageToken,
	}, nil
}

func (s *APIV1Service) GetAIPlatform(ctx context.Context, request *apiv1.GetAIPlatformRequest) (*apiv1.AIPlatform, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}

	// 打印用户ID
	slog.Info("GetAIPlatform called", "userID", user.ID)

	name := request.GetName()
	if name == "" {
		return nil, status.Errorf(codes.InvalidArgument, "name is required")
	}

	// 从名称中提取 ID
	id, err := extractPlatformID(name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid name format: %v", err)
	}

	aiPlatform, err := s.Store.GetAIPlatform(ctx, id)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get AI platform: %v", err)
	}
	if aiPlatform == nil {
		return nil, status.Errorf(codes.NotFound, "AI platform not found")
	}

	return convertAIPlatformFromStore(aiPlatform), nil
}

func (s *APIV1Service) UpdateAIPlatform(ctx context.Context, request *apiv1.UpdateAIPlatformRequest) (*apiv1.AIPlatform, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}

	platform := request.GetPlatform()
	slog.Debug("UpdateAIPlatform called", "userID", user.ID, "request:", platform)
	if platform == nil {
		return nil, status.Errorf(codes.InvalidArgument, "platform is empty")
	}

	name := platform.GetName()
	if name == "" {
		return nil, status.Errorf(codes.InvalidArgument, "name is required")
	}

	id, err := extractPlatformID(name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid name format: %v", err)
	}

	// 检查平台是否存在
	existing, err := s.Store.GetAIPlatform(ctx, id)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get AI platform: %v", err)
	}
	if existing == nil {
		return nil, status.Errorf(codes.NotFound, "AI platform not found")
	}

	// 更新数据
	update := &store.AIPlatform{
		ID:        id,
		UpdatedTs: time.Now().Unix(),
	}

	// 根据 update_mask 更新字段
	paths := request.GetUpdateMask().GetPaths()
	if len(paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	for _, path := range paths {
		switch path {
		case "url":
			update.URL = platform.GetUrl()
		case "access_key":
			update.AccessKey = platform.GetAccessKey()
		case "display_name":
			update.DisplayName = platform.GetDisplayName()
		case "description":
			update.Description = platform.GetDescription()
		case "model":
			update.Model = platform.GetModel()
		}
	}

	aiPlatform, err := s.Store.UpdateAIPlatform(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update AI platform: %v", err)

	}

	return convertAIPlatformFromStore(aiPlatform), nil
}

func (s *APIV1Service) DeleteAIPlatform(ctx context.Context, request *apiv1.DeleteAIPlatformRequest) (*emptypb.Empty, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}

	// 打印用户ID
	slog.Info("DeleteAIPlatform called", "userID", user.ID)

	name := request.GetName()
	if name == "" {
		return nil, status.Errorf(codes.InvalidArgument, "name is required")
	}

	id, err := extractPlatformID(name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid name format: %v", err)
	}

	// 确认平台存在
	existing, err := s.Store.GetAIPlatform(ctx, id)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get AI platform: %v", err)
	}
	if existing == nil {
		return nil, status.Errorf(codes.NotFound, "AI platform not found")
	}

	err = s.Store.DeleteAIPlatform(ctx, id)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete AI platform: %v", err)
	}

	slog.Info("AI platform deleted", "id", id)
	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) GenerateAnswer(ctx context.Context, request *apiv1.GenerateAnswerRequest) (*apiv1.GenerateAnswerResponse, error) {
	user, err := s.GetCurrentUser(ctx)
	slog.Info("GenerateAnswer called", "userID", user.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}

	// 获取平台信息
	id, err := extractPlatformID(request.GetName())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid name format: %v", err)
	}

	platform, err := s.Store.GetAIPlatform(ctx, id)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get AI platform: %v", err)
	}
	if platform == nil {
		return nil, status.Errorf(codes.NotFound, "AI platform not found")
	}

	// 创建 HTTP 客户端
	client := &http.Client{
		Timeout: 60 * time.Second,
	}

	// 构建请求
	requestBody := map[string]interface{}{
		"model": platform.Model,
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": request.GetPrompt(),
			},
		},
		"stream": false,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to marshal request: %v", err)
	}

	// 创建请求
	req, err := http.NewRequest("POST", platform.URL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create request: %v", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	if platform.AccessKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", platform.AccessKey))
	}

	// 打印请求信息
	slog.Info("GenerateAnswer request",
		"url", platform.URL,
		"body", string(jsonData),
	)

	// 发送请求
	resp, err := client.Do(req)
	if err != nil {
		return &apiv1.GenerateAnswerResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Failed to connect to AI platform: %v", err),
		}, nil
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &apiv1.GenerateAnswerResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Failed to read response: %v", err),
		}, nil
	}

	// 打印完整的响应信息
	slog.Info("GenerateAnswer response",
		"status", resp.StatusCode,
		"headers", resp.Header,
		"body", string(body),
	)

	// 检查响应状态
	if resp.StatusCode != http.StatusOK {
		return &apiv1.GenerateAnswerResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("AI platform returned error status: %d, body: %s", resp.StatusCode, string(body)),
		}, nil
	}

	// 解析响应
	var responseMap map[string]interface{}
	if err := json.Unmarshal(body, &responseMap); err != nil {
		return &apiv1.GenerateAnswerResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Failed to parse response: %v", err),
		}, nil
	}

	// 适配 Ollama 的响应格式
	message, ok := responseMap["message"].(map[string]interface{})
	if !ok {
		return &apiv1.GenerateAnswerResponse{
			Success:      false,
			ErrorMessage: "Invalid response format: missing message",
		}, nil
	}

	content, ok := message["content"].(string)
	if !ok {
		return &apiv1.GenerateAnswerResponse{
			Success:      false,
			ErrorMessage: "Invalid response format: missing content",
		}, nil
	}

	// 移除 think 标签
	content = strings.ReplaceAll(content, "<think>", "")
	content = strings.ReplaceAll(content, "</think>", "")
	content = strings.TrimSpace(content)

	// 生成成功
	return &apiv1.GenerateAnswerResponse{
		Success: true,
		Answer:  content,
	}, nil
}

// 工具函数：将存储模型转换为 API 模型
func convertAIPlatformFromStore(platform *store.AIPlatform) *apiv1.AIPlatform {
	if platform == nil {
		return nil
	}

	return &apiv1.AIPlatform{
		Name:        fmt.Sprintf("ai-platforms/%d", platform.ID),
		Url:         platform.URL,
		AccessKey:   platform.AccessKey,
		DisplayName: platform.DisplayName,
		Description: platform.Description,
		Model:       platform.Model,
		CreateTime:  timestamppb.New(time.Unix(platform.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(platform.UpdatedTs, 0)),
	}
}

// 从资源名称中提取 ID
func extractPlatformID(name string) (int32, error) {
	parts := strings.Split(name, "/")
	if len(parts) != 2 || parts[0] != "ai-platforms" {
		return 0, fmt.Errorf("invalid resource name format, expected 'ai-platforms/{id}'")
	}

	id, err := strconv.ParseInt(parts[1], 10, 32)
	if err != nil {
		return 0, fmt.Errorf("invalid id: %v", err)
	}

	return int32(id), nil
}
