import OutCall "http-outcalls/outcall";
import Time "mo:core/Time";
import Nat64 "mo:core/Nat64";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Int64 "mo:core/Int64";

actor {
  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  // Get current nanoseconds timestamp
  public shared ({ caller }) func now() : async Nat64 {
    let nowInt = Time.now();
    let nowNat = nowInt.toNat();
    Nat64.fromNat(nowNat);
  };

  // Helper function to get current timestamp as Text (milliseconds)
  func getCurrentTimestamp() : Text {
    let nowNanos = Nat64.fromNat(Int.abs(Time.now()));
    let millis : Nat64 = nowNanos / 1_000_000;
    Int64.fromNat64(millis).toText();
  };

  // Build query string for market order
  func buildMarketOrderQueryString(symbol : Text, side : Text, quantity : Text, timestamp : Text) : Text {
    "symbol=".concat(symbol).concat(
      "&side=".concat(side),
    ) # "&type=MARKET&quantity=" # quantity # "&timestamp=" # timestamp;
  };

  // Build query string for limit order
  func buildLimitOrderQueryString(symbol : Text, side : Text, quantity : Text, price : Text, timestamp : Text) : Text {
    "symbol=".concat(symbol).concat(
      "&side=".concat(side),
    ) # "&type=LIMIT&timeInForce=GTC" # "&quantity=" # quantity # "&price=" # price # "&timestamp=" # timestamp;
  };

  // Build query string for stop market order
  func buildStopMarketOrderQueryString(symbol : Text, side : Text, quantity : Text, stopPrice : Text, timestamp : Text) : Text {
    "symbol=".concat(symbol).concat(
      "&side=".concat(side),
    ) # "&type=STOP_MARKET" # "&quantity=" # quantity # "&stopPrice=" # stopPrice # "&timestamp=" # timestamp;
  };

  // Build query string for take profit market order
  func buildTakeProfitMarketOrderQueryString(symbol : Text, side : Text, quantity : Text, stopPrice : Text, timestamp : Text) : Text {
    "symbol=".concat(symbol).concat(
      "&side=".concat(side),
    ) # "&type=TAKE_PROFIT_MARKET" # "&quantity=" # quantity # "&stopPrice=" # stopPrice # "&timestamp=" # timestamp;
  };

  // Build query string for cancel order
  func buildCancelOrderQueryString(symbol : Text, orderId : Text, timestamp : Text) : Text {
    "symbol=".concat(symbol).concat(
      "&orderId=".concat(orderId),
    ) # "&timestamp=" # timestamp;
  };

  func appendSignature(queryString : Text, signature : Text) : Text {
    queryString # "&signature=" # signature;
  };

  // Helper function to execute HTTP POST with retry
  func executeHttpPostWithRetryWithToken(
    apiKey : Text,
    url : Text,
    transform : OutCall.Transform,
    body : Text,
    maxRetries : Nat,
  ) : async ?Text {
    var attempt = 0;
    var response : ?Text = null;

    let headers : [OutCall.Header] = [
      { name = "X-MBX-APIKEY"; value = apiKey },
      { name = "Content-Type"; value = "application/x-www-form-urlencoded" },
    ];

    while (attempt < maxRetries and response == null) {
      let result = await OutCall.httpPostRequest(url, headers, body, transform);
      response := ?result;
      attempt += 1;
    };

    response;
  };

  // Helper function to execute HTTP DELETE with retry
  func executeHttpDeleteWithRetryWithToken(
    apiKey : Text,
    url : Text,
    transform : OutCall.Transform,
    body : Text,
    maxRetries : Nat,
  ) : async ?Text {
    var attempt = 0;
    var response : ?Text = null;

    let headers : [OutCall.Header] = [
      { name = "X-MBX-APIKEY"; value = apiKey },
      { name = "Content-Type"; value = "application/x-www-form-urlencoded" },
    ];

    while (attempt < maxRetries and response == null) {
      let result = await OutCall.httpPostRequest(url, headers, body, transform);
      response := ?result;
      attempt += 1;
    };

    response;
  };

  // Place market order
  public shared ({ caller }) func placeMarketOrder(
    apiKey : Text,
    _apiSecret : Text,
    symbol : Text,
    side : Text,
    quantity : Text,
  ) : async { status : Text; message : Text } {
    let timestampText = getCurrentTimestamp();
    let queryString = buildMarketOrderQueryString(symbol, side, quantity, timestampText);
    let fullQueryString = appendSignature(queryString, "signature");
    let url = "https://fapi.binance.com/fapi/v1/order?" # fullQueryString;

    switch (await executeHttpPostWithRetryWithToken(apiKey, url, transform, "", 3)) {
      case (?response) { { status = "success"; message = response } };
      case (null) { { status = "error"; message = "Failed to execute HTTP POST after retries" } };
    };
  };

  // Public query functions
  public shared ({ caller }) func placeLimitOrder(
    apiKey : Text,
    _apiSecret : Text,
    symbol : Text,
    side : Text,
    quantity : Text,
    price : Text,
  ) : async { status : Text; message : Text } {
    let timestampText = getCurrentTimestamp();
    let queryString = buildLimitOrderQueryString(symbol, side, quantity, price, timestampText);
    let fullQueryString = appendSignature(queryString, "signature");
    let url = "https://fapi.binance.com/fapi/v1/order?" # fullQueryString;

    switch (await executeHttpPostWithRetryWithToken(apiKey, url, transform, "", 3)) {
      case (?response) { { status = "success"; message = response } };
      case (null) { { status = "error"; message = "Failed to execute HTTP POST after retries" } };
    };
  };

  // Public query functions
  public shared ({ caller }) func placeStopMarketOrder(
    apiKey : Text,
    _apiSecret : Text,
    symbol : Text,
    side : Text,
    quantity : Text,
    stopPrice : Text,
  ) : async { status : Text; message : Text } {
    let timestampText = getCurrentTimestamp();
    let queryString = buildStopMarketOrderQueryString(symbol, side, quantity, stopPrice, timestampText);
    let fullQueryString = appendSignature(queryString, "signature");
    let url = "https://fapi.binance.com/fapi/v1/order?" # fullQueryString;

    switch (await executeHttpPostWithRetryWithToken(apiKey, url, transform, "", 3)) {
      case (?response) { { status = "success"; message = response } };
      case (null) { { status = "error"; message = "Failed to execute HTTP POST after retries" } };
    };
  };

  // Public query functions
  public shared ({ caller }) func placeTakeProfitMarketOrder(
    apiKey : Text,
    _apiSecret : Text,
    symbol : Text,
    side : Text,
    quantity : Text,
    stopPrice : Text,
  ) : async { status : Text; message : Text } {
    let timestampText = getCurrentTimestamp();
    let queryString = buildTakeProfitMarketOrderQueryString(symbol, side, quantity, stopPrice, timestampText);
    let fullQueryString = appendSignature(queryString, "signature");
    let url = "https://fapi.binance.com/fapi/v1/order?" # fullQueryString;

    switch (await executeHttpPostWithRetryWithToken(apiKey, url, transform, "", 3)) {
      case (?response) { { status = "success"; message = response } };
      case (null) { { status = "error"; message = "Failed to execute HTTP POST after retries" } };
    };
  };

  // Public query functions
  public shared ({ caller }) func cancelOrder(
    apiKey : Text,
    _apiSecret : Text,
    symbol : Text,
    orderId : Text,
  ) : async { status : Text; message : Text } {
    let timestampText = getCurrentTimestamp();
    let queryString = buildCancelOrderQueryString(symbol, orderId, timestampText);
    let fullQueryString = appendSignature(queryString, "signature");
    let url = "https://fapi.binance.com/fapi/v1/order?" # fullQueryString;

    switch (await executeHttpDeleteWithRetryWithToken(apiKey, url, transform, "", 3)) {
      case (?response) { { status = "success"; message = response } };
      case (null) { { status = "error"; message = "Failed to execute HTTP DELETE after retries" } };
    };
  };
};
