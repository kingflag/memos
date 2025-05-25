package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateAIPlatform(ctx context.Context, create *store.AIPlatform) (*store.AIPlatform, error) {
	fields := []string{"`platform_type`", "`url`", "`access_key`", "`display_name`", "`description`", "`model`", "`created_ts`", "`updated_ts`"}
	placeholder := []string{"?", "?", "?", "?", "?", "?", "?", "?"}
	args := []any{
		create.PlatformType,
		create.URL,
		create.AccessKey,
		create.DisplayName,
		create.Description,
		create.Model,
		create.CreatedTs,
		create.UpdatedTs,
	}

	stmt := "INSERT INTO `ai_platform` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING `id`"
	var id int32
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(&id); err != nil {
		return nil, err
	}

	find := &store.FindAIPlatform{
		ID: &id,
	}
	platforms, err := d.ListAIPlatforms(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(platforms) == 0 {
		return nil, fmt.Errorf("failed to find newly created ai platform")
	}

	return platforms[0], nil
}

func (d *DB) ListAIPlatforms(ctx context.Context, find *store.FindAIPlatform) ([]*store.AIPlatform, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "`ai_platform`.`id` = ?"), append(args, *v)
	}
	if v := find.PlatformType; v != nil {
		where, args = append(where, "`ai_platform`.`platform_type` = ?"), append(args, *v)
	}

	fields := []string{
		"`ai_platform`.`id` AS `id`",
		"`ai_platform`.`platform_type` AS `platform_type`",
		"`ai_platform`.`url` AS `url`",
		"`ai_platform`.`access_key` AS `access_key`",
		"`ai_platform`.`display_name` AS `display_name`",
		"`ai_platform`.`description` AS `description`",
		"`ai_platform`.`model` AS `model`",
		"`ai_platform`.`created_ts` AS `created_ts`",
		"`ai_platform`.`updated_ts` AS `updated_ts`",
	}

	query := "SELECT " + strings.Join(fields, ", ") +
		" FROM `ai_platform` " +
		"WHERE " + strings.Join(where, " AND ") + " " +
		"ORDER BY `created_ts` DESC"

	if find.Limit != nil {
		query = fmt.Sprintf("%s LIMIT %d", query, *find.Limit)
		if find.Offset != nil {
			query = fmt.Sprintf("%s OFFSET %d", query, *find.Offset)
		}
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.AIPlatform, 0)
	for rows.Next() {
		var platform store.AIPlatform
		if err := rows.Scan(
			&platform.ID,
			&platform.PlatformType,
			&platform.URL,
			&platform.AccessKey,
			&platform.DisplayName,
			&platform.Description,
			&platform.Model,
			&platform.CreatedTs,
			&platform.UpdatedTs,
		); err != nil {
			return nil, err
		}
		list = append(list, &platform)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) UpdateAIPlatform(ctx context.Context, update *store.UpdateAIPlatform) error {
	set, args := []string{}, []any{}

	if v := update.PlatformType; v != nil {
		set, args = append(set, "`platform_type` = ?"), append(args, *v)
	}
	if v := update.URL; v != nil {
		set, args = append(set, "`url` = ?"), append(args, *v)
	}
	if v := update.AccessKey; v != nil {
		set, args = append(set, "`access_key` = ?"), append(args, *v)
	}
	if v := update.DisplayName; v != nil {
		set, args = append(set, "`display_name` = ?"), append(args, *v)
	}
	if v := update.Description; v != nil {
		set, args = append(set, "`description` = ?"), append(args, *v)
	}
	if v := update.Model; v != nil {
		set, args = append(set, "`model` = ?"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "`updated_ts` = ?"), append(args, *v)
	}

	if len(set) == 0 {
		return nil
	}

	args = append(args, update.ID)

	stmt := "UPDATE `ai_platform` SET " + strings.Join(set, ", ") + " WHERE `id` = ?"
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}

	return nil
}

func (d *DB) DeleteAIPlatform(ctx context.Context, delete *store.DeleteAIPlatform) error {
	where, args := []string{"`id` = ?"}, []any{delete.ID}
	stmt := "DELETE FROM `ai_platform` WHERE " + strings.Join(where, " AND ")
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}
