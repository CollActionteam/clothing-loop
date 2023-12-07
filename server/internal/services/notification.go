package services

import (
	"github.com/the-clothing-loop/website/server/internal/app"
	"github.com/the-clothing-loop/website/server/internal/models"
	"github.com/the-clothing-loop/website/server/internal/views"
	"gorm.io/gorm"
)

func SendElapsedNotifications(db *gorm.DB) error {
	notifications, err := models.GetElapsedNotifications(db)
	if err != nil {
		return err
	}
	for _, notification := range notifications {
		sendErr := app.OneSignalCreateNotification(
			db,
			[]string{string(notification.UserID)},
			*views.Notifications[notification.Title],
			*views.Notifications[notification.Content],
		)
		if sendErr != nil {
			return sendErr
		}
		deleteErr := notification.Delete(db)
		if deleteErr != nil {
			return deleteErr
		}
	}
	return nil
}
