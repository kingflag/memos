package v1

import (
	"context"
	"fmt"
	"log/slog"
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

	// 创建存储模型
	create := &store.AIPlatform{
		URL:         platform.Url,
		AccessKey:   platform.AccessKey,
		DisplayName: platform.DisplayName,
		Description: platform.Description,
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

	// 打印用户ID
	slog.Info("UpdateAIPlatform called", "userID", user.ID)

	platform := request.GetPlatform()
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
