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

	// Print user ID
	slog.Info("CreateAIPlatform called", "userID", user.ID)

	platform := request.GetPlatform()
	if platform == nil {
		return nil, status.Errorf(codes.InvalidArgument, "platform is empty")
	}

	// Validate required fields
	if platform.Url == "" {
		return nil, status.Errorf(codes.InvalidArgument, "url is required")
	}
	// Trim spaces from URL
	platform.Url = strings.TrimSpace(platform.Url)
	if platform.AccessKey == "" {
		return nil, status.Errorf(codes.InvalidArgument, "access key is required")
	}
	if platform.DisplayName == "" {
		return nil, status.Errorf(codes.InvalidArgument, "display name is required")
	}
	if platform.Model == "" {
		return nil, status.Errorf(codes.InvalidArgument, "model is required")
	}

	// Create storage model
	create := &store.AIPlatform{
		PlatformType: platform.PlatformType.String(),
		URL:          platform.Url,
		AccessKey:    platform.AccessKey,
		DisplayName:  platform.DisplayName,
		Description:  platform.Description,
		Model:        platform.Model,
		CreatedTs:    time.Now().Unix(),
		UpdatedTs:    time.Now().Unix(),
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

	// Print user ID
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

	// Implement pagination support
	find := &store.FindAIPlatform{
		Limit:  &limitPlusOne,
		Offset: &offset,
	}
	aiPlatforms, err := s.Store.ListAIPlatforms(ctx, find)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list AI platforms: %v", err)
	}

	platforms := make([]*apiv1.AIPlatform, 0, len(aiPlatforms))
	nextPageToken := ""

	// Simple pagination handling, should be implemented at database level
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

	// Print user ID
	slog.Info("GetAIPlatform called", "userID", user.ID)

	id := request.Id
	platform, err := s.Store.GetAIPlatform(ctx, &store.FindAIPlatform{
		ID: &id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get AI platform: %v", err)
	}
	if platform == nil {
		return nil, status.Errorf(codes.NotFound, "AI platform not found")
	}
	return convertAIPlatformFromStore(platform), nil
}

func (s *APIV1Service) UpdateAIPlatform(ctx context.Context, request *apiv1.UpdateAIPlatformRequest) (*apiv1.AIPlatform, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}

	if request.Platform == nil {
		return nil, status.Errorf(codes.InvalidArgument, "platform is required")
	}

	// Print platform_type from request
	slog.Debug("UpdateAIPlatform request", "userID", user.ID, "platform_type", request.Platform.PlatformType)

	// Check if platform exists
	existing, err := s.Store.GetAIPlatform(ctx, &store.FindAIPlatform{ID: &request.Platform.Id})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get AI platform: %v", err)
	}
	if existing == nil {
		return nil, status.Errorf(codes.NotFound, "AI platform not found")
	}

	// Print existing platform's platform_type
	slog.Debug("Existing platform", "userID", user.ID, "platform_type", existing.PlatformType)

	// Update fields based on update_mask
	platform := &store.AIPlatform{
		ID: request.Platform.Id,
	}

	// If no update_mask provided, update all fields
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		platform.PlatformType = request.Platform.PlatformType.String()
		platform.URL = request.Platform.Url
		platform.AccessKey = request.Platform.AccessKey
		platform.DisplayName = request.Platform.DisplayName
		platform.Description = request.Platform.Description
		platform.Model = request.Platform.Model
	} else {
		// Update specified fields based on update_mask
		for _, path := range request.UpdateMask.Paths {
			switch path {
			case "platform_type":
				platform.PlatformType = request.Platform.PlatformType.String()
			case "url":
				platform.URL = request.Platform.Url
			case "access_key":
				platform.AccessKey = request.Platform.AccessKey
			case "display_name":
				platform.DisplayName = request.Platform.DisplayName
			case "description":
				platform.Description = request.Platform.Description
			case "model":
				platform.Model = request.Platform.Model
			}
		}
	}

	platform.UpdatedTs = time.Now().Unix()

	// Print platform_type before update
	slog.Debug("Updating platform", "userID", user.ID, "platform_type", platform.PlatformType)

	updatedPlatform, err := s.Store.UpdateAIPlatform(ctx, platform)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update AI platform: %v", err)
	}

	// Print platform_type after update
	slog.Debug("Updated platform", "userID", user.ID, "platform_type", updatedPlatform.PlatformType)

	return convertAIPlatformFromStore(updatedPlatform), nil
}

func (s *APIV1Service) DeleteAIPlatform(ctx context.Context, request *apiv1.DeleteAIPlatformRequest) (*emptypb.Empty, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}

	// Print user ID
	slog.Info("DeleteAIPlatform called", "userID", user.ID)

	err = s.Store.DeleteAIPlatform(ctx, request.Id)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete AI platform: %v", err)
	}

	slog.Info("AI platform deleted", "id", request.Id)
	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) GenerateAnswer(ctx context.Context, request *apiv1.GenerateAnswerRequest) (*apiv1.GenerateAnswerResponse, error) {
	user, err := s.GetCurrentUser(ctx)
	slog.Info("GenerateAnswer called", "userID", user.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}

	// Get platform information
	id := request.Id
	platform, err := s.Store.GetAIPlatform(ctx, &store.FindAIPlatform{
		ID: &id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get AI platform: %v", err)
	}
	if platform == nil {
		return nil, status.Errorf(codes.NotFound, "AI platform not found")
	}

	// Trim spaces from URL
	platform.URL = strings.TrimSpace(platform.URL)

	// Create HTTP client
	client := &http.Client{
		Timeout: 60 * time.Second,
	}

	// Build request
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

	// Create request
	req, err := http.NewRequest("POST", platform.URL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create request: %v", err)
	}

	// Set request headers
	req.Header.Set("Content-Type", "application/json")
	if platform.AccessKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", platform.AccessKey))
	}

	// Print request information
	slog.Info("GenerateAnswer request",
		"url", platform.URL,
		"body", string(jsonData),
	)

	// Send request
	resp, err := client.Do(req)
	if err != nil {
		return &apiv1.GenerateAnswerResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Failed to connect to AI platform: %v", err),
		}, nil
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &apiv1.GenerateAnswerResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Failed to read response: %v", err),
		}, nil
	}

	// Print complete response information
	slog.Info("GenerateAnswer response",
		"status", resp.StatusCode,
		"headers", resp.Header,
		"body", string(body),
	)

	// Check response status
	if resp.StatusCode != http.StatusOK {
		return &apiv1.GenerateAnswerResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("AI platform returned error status: %d, body: %s", resp.StatusCode, string(body)),
		}, nil
	}

	// Parse response
	var responseMap map[string]interface{}
	if err := json.Unmarshal(body, &responseMap); err != nil {
		return &apiv1.GenerateAnswerResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Failed to parse response: %v", err),
		}, nil
	}

	// Parse response based on platform type
	var content string
	var parseErr error

	switch platform.PlatformType {
	case "OLLAMA":
		// Ollama response format: { message: { content: string } }
		if message, ok := responseMap["message"].(map[string]interface{}); ok {
			if content, ok = message["content"].(string); ok {
				// Remove think tags
				content = strings.ReplaceAll(content, "<think>", "")
				content = strings.ReplaceAll(content, "</think>", "")
				content = strings.TrimSpace(content)
				return &apiv1.GenerateAnswerResponse{
					Success: true,
					Answer:  content,
				}, nil
			}
		}
		parseErr = fmt.Errorf("invalid Ollama response format")

	case "DEEPSEEK":
		// DeepSeek response format: { choices: [{ message: { content: string } }] }
		if choices, ok := responseMap["choices"].([]interface{}); ok && len(choices) > 0 {
			if choice, ok := choices[0].(map[string]interface{}); ok {
				if message, ok := choice["message"].(map[string]interface{}); ok {
					if content, ok := message["content"].(string); ok {
						return &apiv1.GenerateAnswerResponse{
							Success: true,
							Answer:  content,
						}, nil
					}
				}
			}
		}
		parseErr = fmt.Errorf("invalid DeepSeek response format")

	default:
		// Try generic format: { response: string }
		if content, ok := responseMap["response"].(string); ok {
			return &apiv1.GenerateAnswerResponse{
				Success: true,
				Answer:  content,
			}, nil
		}
		parseErr = fmt.Errorf("unsupported platform type: %s", platform.PlatformType)
	}

	// If all formats fail to parse
	return &apiv1.GenerateAnswerResponse{
		Success:      false,
		ErrorMessage: fmt.Sprintf("Failed to parse response: %v", parseErr),
	}, nil
}

// Helper function: Convert storage model to API model
func convertAIPlatformFromStore(platform *store.AIPlatform) *apiv1.AIPlatform {
	if platform == nil {
		return nil
	}

	// Print platform_type before conversion
	slog.Debug("Converting platform", "platform_type", platform.PlatformType)

	platformType := apiv1.PlatformType_UNSPECIFIED
	switch platform.PlatformType {
	case "OLLAMA":
		platformType = apiv1.PlatformType_OLLAMA
	case "DEEPSEEK":
		platformType = apiv1.PlatformType_DEEPSEEK
	}

	// Print platform_type after conversion
	slog.Debug("Converted platform", "platform_type", platformType)

	return &apiv1.AIPlatform{
		Id:           platform.ID,
		PlatformType: platformType,
		Url:          platform.URL,
		AccessKey:    platform.AccessKey,
		DisplayName:  platform.DisplayName,
		Description:  platform.Description,
		Model:        platform.Model,
		CreateTime:   timestamppb.New(time.Unix(platform.CreatedTs, 0)),
		UpdateTime:   timestamppb.New(time.Unix(platform.UpdatedTs, 0)),
	}
}

// Extract ID from resource name
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
