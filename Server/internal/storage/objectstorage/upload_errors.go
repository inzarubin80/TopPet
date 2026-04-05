package objectstorage

import (
	"strings"
)

// IsNoSuchBucketError reports S3/MinIO errors when the configured bucket does not exist.
func IsNoSuchBucketError(err error) bool {
	if err == nil {
		return false
	}
	s := strings.ToLower(err.Error())
	return strings.Contains(s, "bucket does not exist") ||
		strings.Contains(s, "nosuchbucket") ||
		strings.Contains(s, "no such bucket")
}
