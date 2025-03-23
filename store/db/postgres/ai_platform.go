package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateAIPlatform(ctx context.Context, create *store.AIPlatform) (*store.AIPlatform, error) {
	fields := []string{"url", "access_key", "display_name", "description", "created_ts", "updated_ts"}
	placeholder := []string{"$1", "$2", "$3", "$4", "$5", "$6"}
	args := []any{create.URL, create.AccessKey, create.DisplayName, create.Description, create.CreatedTs, create.UpdatedTs}

	stmt := fmt.Sprintf("INSERT INTO ai_platform (%s) VALUES (%s) RETURNING id", strings.Join(fields, ", "), strings.Join(placeholder, ", "))
	var id int32
	err := d.db.QueryRowContext(ctx, stmt, args...).Scan(&id)
	if err != nil {
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
	where, args := []string{"TRUE"}, []any{}
	argCount := 0

	if v := find.ID; v != nil {
		argCount++
		where, args = append(where, fmt.Sprintf("ai_platform.id = $%d", argCount)), append(args, *v)
	}

	fields := []string{
		"ai_platform.id AS id",
		"ai_platform.url AS url",
		"ai_platform.access_key AS access_key",
		"ai_platform.display_name AS display_name",
		"ai_platform.description AS description",
		"ai_platform.created_ts AS created_ts",
		"ai_platform.updated_ts AS updated_ts",
	}

	query := fmt.Sprintf("SELECT %s FROM ai_platform WHERE %s ORDER BY created_ts DESC",
		strings.Join(fields, ", "),
		strings.Join(where, " AND "))

	if find.Limit != nil {
		argCount++
		query = fmt.Sprintf("%s LIMIT $%d", query, argCount)
		args = append(args, *find.Limit)
		if find.Offset != nil {
			argCount++
			query = fmt.Sprintf("%s OFFSET $%d", query, argCount)
			args = append(args, *find.Offset)
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
			&platform.URL,
			&platform.AccessKey,
			&platform.DisplayName,
			&platform.Description,
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
	argCount := 0

	if v := update.URL; v != nil {
		argCount++
		set, args = append(set, fmt.Sprintf("url = $%d", argCount)), append(args, *v)
	}
	if v := update.AccessKey; v != nil {
		argCount++
		set, args = append(set, fmt.Sprintf("access_key = $%d", argCount)), append(args, *v)
	}
	if v := update.DisplayName; v != nil {
		argCount++
		set, args = append(set, fmt.Sprintf("display_name = $%d", argCount)), append(args, *v)
	}
	if v := update.Description; v != nil {
		argCount++
		set, args = append(set, fmt.Sprintf("description = $%d", argCount)), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		argCount++
		set, args = append(set, fmt.Sprintf("updated_ts = $%d", argCount)), append(args, *v)
	}

	if len(set) == 0 {
		return nil
	}

	argCount++
	args = append(args, update.ID)

	stmt := fmt.Sprintf("UPDATE ai_platform SET %s WHERE id = $%d", strings.Join(set, ", "), argCount)
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}

	return nil
}

func (d *DB) DeleteAIPlatform(ctx context.Context, delete *store.DeleteAIPlatform) error {
	stmt := "DELETE FROM ai_platform WHERE id = $1"
	result, err := d.db.ExecContext(ctx, stmt, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}

	return nil
}
