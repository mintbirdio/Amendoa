(function() {
  const XHR = XMLHttpRequest.prototype;
  const open = XHR.open;
  const send = XHR.send;
  const setRequestHeader = XHR.setRequestHeader;
  XHR.setRequestHeader = function(header, value) {
    if (header.toLowerCase() === "authorization") {
      window.postMessage({
        type: "AMENDOA_AUTH_INTERCEPT",
        payload: { bearer: value }
      }, "*");
    }
    if (header.toLowerCase() === "x-csrf-token") {
      window.postMessage({
        type: "AMENDOA_AUTH_INTERCEPT",
        payload: { csrf: value }
      }, "*");
    }
    return setRequestHeader.apply(this, arguments);
  };
  const isTimelineData = (data) => {
    if (!data || typeof data !== "object") return false;
    const hasData = !!(data.globalObjects || // Home Timeline ("For You" tab)
    data.data && data.data.home && data.data.home.home_timeline_urt || // Following Timeline ("Following" tab) - viewer.timeline structure
    data.data && data.data.viewer && data.data.viewer.timeline || // User Profile Timeline
    data.data && data.data.user && data.data.user.result && data.data.user.result.timeline_v2 || // Legacy Timeline
    data.timeline && data.timeline.instructions || // Tweet Detail / Conversation
    data.data && data.data.threaded_conversation_with_injections_v2 || // Search Results
    data.data && data.data.search_by_raw_query || // Lists
    data.data && data.data.list && data.data.list.tweets_timeline || // UserTweets endpoint (profile page)
    data.data && data.data.user && data.data.user.result && data.data.user.result.timeline || // TweetDetail
    data.data && data.data.tweetResult || // Community Timeline
    data.data && data.data.communityResults && data.data.communityResults.result || // Community Tweets Timeline (alternative structure)
    data.data && data.data.community && data.data.community.community_timeline);
    return hasData;
  };
  const extractReplyNotifications = (data) => {
    const results = [];
    const extractTweetInfo = (tweetResult) => {
      try {
        const tweet = tweetResult?.tweet || tweetResult;
        if (!tweet) return null;
        const legacy = tweet.legacy;
        if (!legacy) return null;
        const user = tweet.core?.user_results?.result || tweet.user_results?.result || tweet.author;
        const userLegacy = user?.legacy || user;
        const fromHandle = userLegacy?.screen_name || "";
        const content = legacy.full_text || "";
        const tweetId = tweet.rest_id || legacy.id_str || "";
        const inReplyTo = legacy.in_reply_to_status_id_str;
        if (fromHandle && tweetId) {
          return { fromHandle, content, tweetId, inReplyTo };
        }
      } catch (e) {
      }
      return null;
    };
    try {
      let instructions = [];
      if (data.data?.viewer?.user_results?.result?.timeline?.timeline?.instructions) {
        instructions = data.data.viewer.user_results.result.timeline.timeline.instructions;
      } else if (data.data?.viewer?.timeline?.timeline?.instructions) {
        instructions = data.data.viewer.timeline.timeline.instructions;
      } else if (data.data?.notifications?.timeline?.instructions) {
        instructions = data.data.notifications.timeline.instructions;
      } else if (data.data?.viewer?.notifications_timeline?.timeline?.instructions) {
        instructions = data.data.viewer.notifications_timeline.timeline.instructions;
      } else if (data.data?.notification_all?.timeline?.instructions) {
        instructions = data.data.notification_all.timeline.instructions;
      }
      if (instructions.length === 0 && data.data) {
        console.error("Amendoa: No notification instructions found. Data keys:", Object.keys(data.data));
      } else {
        console.error("Amendoa: Notification instructions found:", instructions.length);
      }
      for (const instruction of instructions) {
        const entries = instruction.entries || instruction.addEntries?.entries || [];
        for (const entry of entries) {
          const content = entry.content;
          if (!content) continue;
          if (content.itemContent) {
            const itemContent = content.itemContent;
            const notification = itemContent.notification_context?.notification || itemContent.notification;
            const notifType = notification?.notificationType || notification?.type || itemContent.notificationType || entry.entryId?.split("-")[0];
            const isReply = notifType === "notification_reply" || notifType === "reply" || notifType === "Reply" || typeof notifType === "string" && notifType.toLowerCase().includes("reply");
            if (isReply) {
              const tweetResult = itemContent.tweet_results?.result || notification?.tweet?.result || itemContent.tweet?.result;
              const tweetInfo = extractTweetInfo(tweetResult);
              if (tweetInfo) {
                console.error("Amendoa: 📩 Found reply notification from @" + tweetInfo.fromHandle);
                results.push({
                  fromHandle: tweetInfo.fromHandle,
                  content: tweetInfo.content,
                  threadUrl: `https://twitter.com/${tweetInfo.fromHandle}/status/${tweetInfo.tweetId}`,
                  inReplyTo: tweetInfo.inReplyTo
                });
              }
            }
          }
          if (content.items) {
            for (const item of content.items) {
              const itemContent = item.item?.itemContent;
              if (!itemContent) continue;
              const notification = itemContent.notification_context?.notification;
              const notifType = notification?.notificationType || notification?.type;
              const isReply = notifType === "notification_reply" || notifType === "reply" || typeof notifType === "string" && notifType.toLowerCase().includes("reply");
              if (isReply) {
                const tweetResult = itemContent.tweet_results?.result;
                const tweetInfo = extractTweetInfo(tweetResult);
                if (tweetInfo) {
                  results.push({
                    fromHandle: tweetInfo.fromHandle,
                    content: tweetInfo.content,
                    threadUrl: `https://twitter.com/${tweetInfo.fromHandle}/status/${tweetInfo.tweetId}`,
                    inReplyTo: tweetInfo.inReplyTo
                  });
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Amendoa: Error extracting notifications", e);
    }
    console.error("Amendoa: Extracted", results.length, "reply notifications");
    return results;
  };
  XHR.open = function(method, url) {
    this._url = url;
    this._method = method;
    return open.apply(this, arguments);
  };
  XHR.send = function(body) {
    const self = this;
    self._body = body;
    const originalOnReadyStateChange = self.onreadystatechange;
    self.onreadystatechange = function() {
      if (self.readyState === 4 && self.status === 200) {
        try {
          const text = self.responseText;
          if (text && (text.startsWith("{") || text.startsWith("["))) {
            const data = JSON.parse(text);
            const url = self._url;
            if (isTimelineData(data)) {
              console.error("Amendoa: 🟢 Captured Timeline Data via XHR", url);
              window.postMessage({
                type: "AMENDOA_DATA_INTERCEPT",
                payload: { url, data }
              }, "*");
            }
            if (url && url.includes("CreateTweet") && data?.data?.create_tweet) {
              console.error("Amendoa: 🟢 Captured CreateTweet response via XHR");
              window.postMessage({
                type: "AMENDOA_ACTION_INTERCEPT",
                payload: { actionType: "CreateTweet", data }
              }, "*");
            }
            if (url && url.includes("FavoriteTweet")) {
              console.error("Amendoa: 🟢 Captured FavoriteTweet response via XHR");
              window.postMessage({
                type: "AMENDOA_ACTION_INTERCEPT",
                payload: { actionType: "FavoriteTweet", data }
              }, "*");
            }
            if (url && (url.includes("Notifications") || url.includes("notifications"))) {
              console.error("Amendoa: 🟢 Captured Notifications via XHR", url);
              const replyNotifs = extractReplyNotifications(data);
              for (const notif of replyNotifs) {
                console.error("Amendoa: 📩 Reply notification from @" + notif.fromHandle);
                window.postMessage({
                  type: "AMENDOA_NOTIFICATION_INTERCEPT",
                  payload: notif
                }, "*");
              }
            }
          }
        } catch (e) {
        }
      }
      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.apply(this, arguments);
      }
    };
    return send.apply(this, arguments);
  };
  const originalFetch = window.fetch;
  window.fetch = async function(input, _init) {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
    const response = await originalFetch.apply(this, arguments);
    const clone = response.clone();
    clone.json().then((data) => {
      if (isTimelineData(data)) {
        console.error("Amendoa: 🟢 Captured Timeline Data via Fetch", url);
        window.postMessage({
          type: "AMENDOA_DATA_INTERCEPT",
          payload: { url, data }
        }, "*");
      }
      if (url && url.includes("CreateTweet") && data?.data?.create_tweet) {
        console.error("Amendoa: 🟢 Captured CreateTweet response via Fetch");
        window.postMessage({
          type: "AMENDOA_ACTION_INTERCEPT",
          payload: { actionType: "CreateTweet", data }
        }, "*");
      }
      if (url && url.includes("FavoriteTweet")) {
        console.error("Amendoa: 🟢 Captured FavoriteTweet response via Fetch");
        window.postMessage({
          type: "AMENDOA_ACTION_INTERCEPT",
          payload: { actionType: "FavoriteTweet", data }
        }, "*");
      }
      if (url && (url.includes("Notifications") || url.includes("notifications"))) {
        console.error("Amendoa: 🟢 Captured Notifications via Fetch", url);
        const replyNotifs = extractReplyNotifications(data);
        for (const notif of replyNotifs) {
          console.error("Amendoa: 📩 Reply notification from @" + notif.fromHandle);
          window.postMessage({
            type: "AMENDOA_NOTIFICATION_INTERCEPT",
            payload: notif
          }, "*");
        }
      }
    }).catch(() => {
    });
    return response;
  };
  console.log("[Amendoa] Network interceptors active");
})();
