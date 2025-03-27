// store/ai_platform.go
package store

import (
	"context"
)

// AIPlatform 是 AI 平台的存储模型
type AIPlatform struct {
	// ID 是系统生成的唯一标识符
	ID int32

	// 标准字段
	CreatedTs int64
	UpdatedTs int64

	// 领域特定字段
	URL         string
	AccessKey   string
	DisplayName string
	Description string
	Model       string
}

// FindAIPlatform 表示查询 AI 平台的条件
type FindAIPlatform struct {
	ID *int32

	// 分页
	Limit  *int
	Offset *int
}

// UpdateAIPlatform 表示更新 AI 平台的参数
type UpdateAIPlatform struct {
	ID          int32
	URL         *string
	AccessKey   *string
	DisplayName *string
	Description *string
	Model       *string
	UpdatedTs   *int64
}

// DeleteAIPlatform 表示删除 AI 平台的参数
type DeleteAIPlatform struct {
	ID int32
}

// CreateAIPlatform 创建一个新的 AI 平台
func (s *Store) CreateAIPlatform(ctx context.Context, create *AIPlatform) (*AIPlatform, error) {
	return s.driver.CreateAIPlatform(ctx, create)
}

// ListAIPlatforms 列出所有 AI 平台
func (s *Store) ListAIPlatforms(ctx context.Context) ([]*AIPlatform, error) {
	return s.driver.ListAIPlatforms(ctx, &FindAIPlatform{})
}

// GetAIPlatform 获取指定 ID 的 AI 平台
func (s *Store) GetAIPlatform(ctx context.Context, id int32) (*AIPlatform, error) {
	find := &FindAIPlatform{
		ID: &id,
	}

	platforms, err := s.driver.ListAIPlatforms(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(platforms) == 0 {
		return nil, nil
	}

	return platforms[0], nil
}

// UpdateAIPlatform 更新 AI 平台
func (s *Store) UpdateAIPlatform(ctx context.Context, update *AIPlatform) (*AIPlatform, error) {
	updateParam := &UpdateAIPlatform{
		ID:        update.ID,
		UpdatedTs: &update.UpdatedTs,
	}

	if update.URL != "" {
		updateParam.URL = &update.URL
	}
	if update.AccessKey != "" {
		updateParam.AccessKey = &update.AccessKey
	}
	if update.DisplayName != "" {
		updateParam.DisplayName = &update.DisplayName
	}
	if update.Description != "" {
		updateParam.Description = &update.Description
	}
	if update.Model != "" {
		updateParam.Model = &update.Model
	}

	if err := s.driver.UpdateAIPlatform(ctx, updateParam); err != nil {
		return nil, err
	}

	return s.GetAIPlatform(ctx, update.ID)
}

// DeleteAIPlatform 删除 AI 平台
func (s *Store) DeleteAIPlatform(ctx context.Context, id int32) error {
	return s.driver.DeleteAIPlatform(ctx, &DeleteAIPlatform{
		ID: id,
	})
}
