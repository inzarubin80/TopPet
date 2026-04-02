package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

func registrationFieldFromSQLc(r *sqlc_repository.ContestRegistrationField) *model.RegistrationField {
	var idStr, cidStr string
	if r.ID.Valid {
		idStr = uuid.UUID(r.ID.Bytes).String()
	}
	if r.ContestID.Valid {
		cidStr = uuid.UUID(r.ContestID.Bytes).String()
	}
	var opts []string
	if len(r.EnumOptions) > 0 {
		_ = json.Unmarshal(r.EnumOptions, &opts)
	}
	return &model.RegistrationField{
		ID:          idStr,
		ContestID:   model.ContestID(cidStr),
		SortOrder:   int(r.SortOrder),
		Label:       r.Label,
		FieldType:   r.FieldType,
		Required:    r.Required,
		EnumOptions: opts,
		CreatedAt:   r.CreatedAt.Time,
	}
}

func (r *Repository) ListRegistrationFieldsByContest(ctx context.Context, contestID model.ContestID) ([]*model.RegistrationField, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	rows, err := reposqlc.ListRegistrationFieldsByContest(ctx, cid)
	if err != nil {
		return nil, err
	}
	out := make([]*model.RegistrationField, len(rows))
	for i, row := range rows {
		out[i] = registrationFieldFromSQLc(row)
	}
	return out, nil
}

func (r *Repository) ReplaceContestRegistrationFields(ctx context.Context, contestID model.ContestID, items []*model.RegistrationFieldInput) error {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return err
	}
	if err := reposqlc.DeleteRegistrationFieldsByContest(ctx, cid); err != nil {
		return err
	}
	for i, it := range items {
		ft := it.FieldType
		if ft != "string" && ft != "number" && ft != "boolean" && ft != "enum" {
			return errors.New("invalid field_type")
		}
		if ft == "enum" && len(it.EnumOptions) < 1 {
			return errors.New("enum fields require enum_options")
		}
		var enumJSON []byte
		if ft == "enum" {
			var err error
			enumJSON, err = json.Marshal(it.EnumOptions)
			if err != nil {
				return err
			}
		}
		fid := uuid.New()
		if it.ID != "" {
			if parsed, err := uuid.Parse(it.ID); err == nil {
				fid = parsed
			}
		}
		_, err := reposqlc.InsertRegistrationField(ctx, &sqlc_repository.InsertRegistrationFieldParams{
			ID:          pgtype.UUID{Bytes: fid, Valid: true},
			ContestID:   cid,
			SortOrder:   int32(i),
			Label:       it.Label,
			FieldType:   ft,
			Required:    it.Required,
			EnumOptions: enumJSON,
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func registrationAnswersBytes(m map[string]interface{}) ([]byte, error) {
	if m == nil || len(m) == 0 {
		return []byte("{}"), nil
	}
	return json.Marshal(m)
}

func parseRegistrationAnswers(b []byte) map[string]interface{} {
	if len(b) == 0 {
		return map[string]interface{}{}
	}
	var m map[string]interface{}
	if err := json.Unmarshal(b, &m); err != nil || m == nil {
		return map[string]interface{}{}
	}
	return m
}
