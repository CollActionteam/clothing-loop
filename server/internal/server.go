package internal

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
	cron "github.com/go-co-op/gocron"
	"github.com/the-clothing-loop/website/server/internal/app"
	"github.com/the-clothing-loop/website/server/internal/controllers"
	"github.com/the-clothing-loop/website/server/pkg/throttle"
)

var Scheduler *cron.Scheduler

func Routes() *gin.Engine {
	slog.SetLogLoggerLevel(slog.LevelDebug)
	// initialization
	db := app.DatabaseInit()
	app.MailInit()

	app.ChatInit(app.Config.MM_URL, app.Config.MM_TOKEN)
	app.ChatSetDefaultSettings(app.ChatClient)

	if app.Config.ENV == app.EnvEnumProduction || (app.Config.SENDINBLUE_API_KEY != "" && app.Config.ENV == app.EnvEnumDevelopment) {
		app.BrevoInit()
	}

	if app.Config.ONESIGNAL_APP_ID != "" && app.Config.ONESIGNAL_REST_API_KEY != "" {
		app.OneSignalInit()
	}

	// set gin mode
	if app.Config.ENV == app.EnvEnumProduction || app.Config.ENV == app.EnvEnumAcceptance {
		gin.SetMode(gin.ReleaseMode)
		slog.SetLogLoggerLevel(slog.LevelError)
	} else {
		gin.SetMode(gin.DebugMode)
		slog.SetLogLoggerLevel(slog.LevelDebug)
	}

	if app.Config.ENV != app.EnvEnumTesting {
		Scheduler = cron.NewScheduler(time.UTC)

		// At 08:03 on day-of-month 1.
		// https://crontab.guru/#3_3_1_*_*
		Scheduler.Cron("3 8 1 * *").Do(controllers.CronMonthly, db)

		// At minute 31.
		// https://crontab.guru/#31_*_*_*_*
		Scheduler.Cron("31 * * * *").Do(controllers.CronHourly, db)

		// At 08:08.
		// https://crontab.guru/#8_8_*_*_*
		Scheduler.Cron("8 8 * * *").Do(controllers.CronDaily, db)

		Scheduler.StartAsync()

		// testing
		if app.Config.ENV == app.EnvEnumDevelopment {
			Scheduler.RunAll()
		}
	}

	// router
	r := gin.New()
	if app.Config.ENV != app.EnvEnumProduction {
		r.Use(gin.Logger())
	}
	r.Use(controllers.MiddlewareSetDB(db))

	r.Use(func(c *gin.Context) {
		var cookieToken = "token"
		var cookieUser = "user_uid"

		switch app.Config.ENV {
		case app.EnvEnumProduction:
		case app.EnvEnumAcceptance:
			cookieToken += "_acc"
			cookieUser += "_acc"
		default:
			cookieToken += "_dev"
			cookieUser += "_dev"
		}
		c.Set("cookie_token", cookieToken)
		c.Set("cookie_user", cookieUser)
	})

	thr := throttle.Policy(&throttle.Quota{
		Limit:  30,
		Within: 2 * time.Hour,
	}, &throttle.Options{
		IdentificationFunction: func(c *gin.Context) string {
			return c.Query("u")
		},
	})

	// router groups
	v2 := r.Group("/v2")

	// ping
	r.GET("/ping", controllers.Ping)
	v2.GET("/ping", controllers.Ping)

	// info
	v2.GET("/info", controllers.InfoGet)
	v2.GET("/info/top-ten", controllers.InfoTopTen)

	// login
	v2.POST("/register/basic-user", controllers.RegisterBasicUser)
	v2.POST("/register/orphaned-user", controllers.RegisterBasicUser)
	v2.POST("/register/chain-admin", controllers.RegisterChainAdmin)
	v2.POST("/login/email", controllers.LoginEmail)
	v2.GET("/login/validate", thr, controllers.LoginValidate)
	v2.DELETE("/logout", controllers.Logout)
	v2.POST("/refresh-token", controllers.RefreshToken)
	v2.POST("/login/super/as", controllers.LoginSuperAsGenerateLink)
	v2.GET("/login/super/as", controllers.LoginSuperAsRedirect)

	// payments
	v2.POST("/payment/initiate", controllers.PaymentsInitiate)
	v2.POST("/payment/webhook", controllers.PaymentsWebhook)

	// user
	v2.GET("/user", controllers.UserGet)
	v2.GET("/user/all-chain", controllers.UserGetAllOfChain)
	v2.GET("/user/newsletter", controllers.UserHasNewsletter)
	v2.PATCH("/user", controllers.UserUpdate)
	v2.DELETE("/user/purge", controllers.UserPurge)
	v2.POST("/user/transfer-chain", controllers.UserTransferChain)
	v2.GET("/user/check-email", controllers.UserCheckIfEmailExists)

	// chain
	v2.GET("/chain", controllers.ChainGet)
	v2.GET("/chain/all", controllers.ChainGetAll)
	v2.PATCH("/chain", controllers.ChainUpdate)
	v2.DELETE("/chain", controllers.ChainDelete)
	v2.POST("/chain", controllers.ChainCreate)
	v2.POST("/chain/add-user", controllers.ChainAddUser)
	v2.POST("/chain/remove-user", controllers.ChainRemoveUser)
	v2.PATCH("/chain/approve-user", controllers.ChainApproveUser)
	v2.DELETE("/chain/unapproved-user", controllers.ChainDeleteUnapproved)
	v2.POST("/chain/poke", controllers.Poke)
	v2.GET("/chain/near", controllers.ChainGetNear)
	v2.PATCH("/chain/user/note", controllers.ChainChangeUserNote)
	v2.GET("/chain/user/note", controllers.ChainGetUserNote)
	v2.PATCH("/chain/user/warden", controllers.ChainChangeUserWarden)
	v2.GET("/chain/largest", controllers.ChainGetLargest)

	// chat
	v2.PATCH("/chat/user", controllers.ChatPatchUser)
	v2.POST("/chat/channel/create", controllers.ChatCreateChannel)
	v2.POST("/chat/channel/join", controllers.ChatJoinChannels)
	v2.POST("/chat/channel/delete", controllers.ChatDeleteChannel)

	// bag
	v2.GET("/bag/all", controllers.BagGetAll)
	v2.PUT("/bag", controllers.BagPut)
	v2.DELETE("/bag", controllers.BagRemove)
	v2.GET("/bag/history", controllers.BagsHistory)

	// bulky item
	v2.GET("/bulky-item/all", controllers.BulkyGetAll)
	v2.PUT("/bulky-item", controllers.BulkyPut)
	v2.DELETE("/bulky-item", controllers.BulkyRemove)

	// imgbb
	v2.POST("/image", controllers.ImageUpload)
	v2.DELETE("/image", controllers.ImageDeleteDeprecated)
	v2.GET("/image_purge", controllers.ImagePurge)

	// route
	v2.GET("/route/order", controllers.RouteOrderGet)
	v2.POST("/route/order", controllers.RouteOrderSet)
	v2.GET("/route/optimize", controllers.RouteOptimize)
	v2.GET("/route/coordinates", controllers.GetRouteCoordinates)

	// contact
	v2.POST("/contact/newsletter", controllers.ContactNewsletter)
	v2.POST("/contact/email", controllers.ContactMail)

	// event
	v2.GET("/event/:uid/ical", controllers.EventICal)
	v2.GET("/event/:uid", controllers.EventGet)
	v2.GET("/event/all", controllers.EventGetAll)
	v2.GET("/event/previous", controllers.EventGetPrevious)
	v2.POST("/event", controllers.EventCreate)
	v2.PATCH("/event", controllers.EventUpdate)
	v2.DELETE("/event/:uid", controllers.EventDelete)

	return r
}
