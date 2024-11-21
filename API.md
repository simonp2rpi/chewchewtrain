## API endpoint documentation

### General errors
In general, errors will be returned in the following JSON format, for all endpoints:
```json
{
  "success": false,
  "error": "<Error message here>"
}
```

### POST `/signin`
Signs in the user's session, given a sign-in token from Firebase.

Expects form parameters:
| Name | Description |
|---|---|
|`id_token`|Token from Firebase email sign-in|

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### POST `/signup`
Registers a new user, given full name, email, and password. Uses Firebase, plus own MongoDB database, to do this.

Expects form parameters:
| Name | Description |
|---|---|
|`name`|Full name of the user|
|`email`|Email of the user|
|`password`|Password of the user|

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### POST `/signout`
Logs out the current user's session.

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### GET `/signedin`
Returns whether or not the current user's session is logged into any user account on the site.

If successful, produces this JSON result:
```json
{
  "success": true,
  "signed_in": true | false
}
```

### GET `/restaurant`
Returns the list of restaurants available on the site, together with metadata such as names, images, and so on.
**Requires that the user is signed in.**

If successful, produces JSON result like this:
```json
{
  "success": true,
  "list": [
    {
      "id": <restaurant ID as String>,
      "name": <String>,
      "image": <String URL>
    },
    {
      "id": <restaurant ID as String>,
      "name": <String>,
      "image": <String URL>
    },
    ...
  ]
}
```

### GET `/restaurant/:id`
Returns the full menu and info of a given restaurant. *Items do not exist if they are not active, unless the user is a worker/owner of the restaurant or is an admin. If a category has no items, it is not returned by this endpoint.*
**Requires that the user is signed in.**

If successful, produces JSON result like this:
```json
{
  "success": true,
  "id": <String>,
  "name": <String>,
  "image": <String>,
  "categories": [
    {
      "name": <String>,
      "active": true | false <Only returned if worker/owner of restaurant, or admin>,
      "items": [
        {
          "id": <String>,
          "name": <String>,
          "active": true | false <Only returned if worker/owner of restaurant, or admin>,
          "variants": [
            {
              "id": <String>,
              "name": <String>,
              "price_usd": <String>
            },
            ...
          ]
        },
        ...
      ]
    },
    ...
  ]
}
```

### GET `/restaurant/:id/image`
Returns the PNG image data for a thumbnail of a restaurant. **Requires that the user is signed in.**

If successful, returns the PNG result.

### GET `/cart`
Returns the cart of a user, for a given restaurant, if one exists. **Requires that the user is signed in.**

Expects GET parameters:
| Name | Description |
|---|---|
|`restaurant`|ID of the restaurant|

If successful, produces this JSON result:
```json
{
  "success": true,
  "id": <String ID of cart transaction>,
  "items": [
    {
      "item_id": <String>,
      "variant_id": <String>,
      "quantity": <Number>
    },
    ...
  ]
}
```

### POST `/cart`
Begins creating a cart for a user, for a given restaurant, with an initial list of menu item variants to purchase (or none, if empty). **Requires that the user is signed in.**

Expects form parameters:
| Name | Description |
|---|---|
|`restaurant`|ID of the restaurant|
|`items`|Stringified JSON array, representing list of items. See format below.|

Format of items being submitted:
```json
{
  "item_id": <String>,
  "variant_id": <String>,
  "quantity": <Number>
}
```

If successful, produces this JSON result:
```json
{
  "success": true,
  "id": <String ID of cart transaction>
}
```

### PUT `/cart`
Modifies the list of items inside the cart, given its transaction ID.
**Requires that the user is signed in.**

Expects form parameters:
| Name | Description |
|---|---|
|`cart_id`|ID of the cart transaction|
|`items`|Stringified JSON array, representing list of items. See format below.|

Format of items being submitted:
```json
{
  "item_id": <String>,
  "variant_id": <String>,
  "quantity": <Number>
}
```

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### GET `/order`
Lists all transactions/orders made by the current user, which aren't in a cart.
**Requires that the user is signed in.**

If successful, produces this JSON result:
```json
{
  "success": true,
  "active": [
    <Transaction ID as String>,
    ...
  ],
  "past": [
    <Transaction ID as String>,
    ...
  ]
}
```

### POST `/order`
Given a cart transaction ID, this will submit the cart as an order, completing the transaction. Verifies that all items/variants still exist and are still active.
**Requires that the user is signed in.**

Expects form parameters:
| Name | Description |
|---|---|
|`cart_id`|ID of the cart transaction|
|*TBA*|Payment info, such as fake credit card number, could go here if we want. For now, we can ignore this.|

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### GET `/order/:id`
Returns the details for a specific order/transaction, if the user has permission to see it. The transaction must not be in a cart (`in_cart` in database must be `false`). **Requires that this transaction was made by the current user, OR the current user is an admin, OR the current user is a worker/owner of the restaurant the transaction was made for.**

If successful, produces this JSON result:
```json
{
  "success": true,
  "id": <String ID of this transaction>,
  "items": [
    {
      "item_id": <String>,
      "variant_id": <String>,
      "quantity": <Number>
    },
    ...
  ],
  "completed": true | false,
  "canceled": true | false,
  "time_ordered": <Number>,
  "time_completed": <Number>,
  "restaurant": <String ID of restaurant>,
  "user": <String ID of user that made transaction>,
  "workers": <String list of workers assigned to this order>
}
```

### PUT `/order/:id`
This endpoint is intended to be called by a worker, to assign themselves to an order. **Requires that the user is a worker/owner of the restaurant the order is for (or is an admin).**

Expects form parameters:
|Name|Description|
|---|---|
|`remove`|"true" or "false" as a string. If "true", this removes the worker instead of adding.|

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### DELETE `/order/:id`
Cancels an *active* order made by the user (or another user), and moves it to past transactions. This doesn't actually delete the transaction, it just marks it as canceled and/or completed. **Requires that this transaction was made by the current user, or that the user is a worker/owner of the restaurant (or is an admin), and can complete the order.**

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### GET `/restaurant/:id/item/:itemid`
Returns the data for a specific menu item on a restaurant. *In the database, if `active` is `false` on the item, then it can only be seen by workers/owners of the restaurant, or an admin user.* **Requires that the user is signed in.**

If successful, produces this JSON result:
```json
{
  "success": true,
  "id": <String>,
  "name": <String>,
  "active": true | false <Only returned if worker/owner of restaurant, or admin>,
  "variants": [
    {
      "id": <String>,
      "name": <String>,
      "price_usd": <String>
    },
    ...
  ]
}
```

### POST `/feedback`
Sends feedback to a restaurant, or for a specific past (completed) transaction. **Requires that the user is signed in, and if a transaction is specified, that the user made that transaction.**

Expects form parameters:
|Name|Description|
|---|---|
|`feedback_type`|Either `restaurant` or `transaction`.|
|`feedback_id`|ID of the restaurant or transaction.|
|`message`|String message/content to be sent as feedback.|
|`contact`|String of user-provided contact info, such as email. Could be anything.|


If successful, produces this JSON result:
```json
{
  "success": true,
  "id": <String ID of feedback entry>
}
```

### GET `/restaurant/:id/order`
Retrieves a list of order IDs received by the given restaurant. **Requires that the user is a worker/owner of the restaurant, or is an admin.**

If successful, produces this JSON result:
```json
{
  "success": true,
  "active": [
    <String ID of order>,
    ...
  ],
  "past": [
    <String ID of order>,
    ...
  ]
}
```

### PUT `/restaurant/:id/item/:itemid`
Updates information about a menu item for a restaurant. **Requires that the user is a worker/owner of the restaurant, or is an admin.**

Expects *optional* form parameters:
|Name|Description|
|---|---|
|`active`|`true` \| `false`|,
|`name` **(owner/admin only)**|String name of item|
|`variants` **(owner/admin only)**|Stringified JSON array of menu item variant information to *add*. Variants/items cannot be deleted; the item must be deactivated, and a new item must be made instead. Format below.|

Variant info format:
```json
{
  "name": <String>,
  "price_usd": <String>
}
```

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### GET `/restaurant/:id/feedback`
Retrieves all feedback entries that this user has access to see for this restaurant. That is, all feedback entries that are for this restaurant, or were made on a transaction for this restaurant. **Requires that the user is a worker/owner of the restaurant, or is an admin.**

If successful, produces this JSON result:
```json
{
  "success": true,
  "list": [
    {
      "id": <String ID of feedback entry>,
      "feedback_type": "restaurant" | "transaction",
      "feedback_id": <String ID of restaurant or transaction>,
      "message": <String message>,
      "contact": <String contact info>
    }
  ]
}
```

### PUT `/restaurant/:id`
Updates the basic information about a restaurant. **Requires that the user is an owner of the restaurant, or is an admin.**

Expects *optional* form parameters:
|Name|Description|
|---|---|
|`name`|String name of restaurant|
|`image`|Image data for restaurant thumbnail|

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### POST `/restaurant/:id/item`
Adds a new menu item to a restaurant. **Requires that the user is an owner of the restaurant, or is an admin.**

Expects form parameters:
|Name|Description|
|---|---|
|`name`|String name of menu item|
|`desc`|String description of menu item|
|`active`|`true` or `false`|
|`category_index`|Category index, as number|
|`variants`|Stringified JSON array of variant info, formatted as below.|

Variant info format:
```json
{
  "name": <String>,
  "price_usd": <String>
}
```

If successful, produces this JSON result:
```json
{
  "success": true,
  "id": <String ID of new menu item>
}
```

### POST `/restaurant/:id/category`
Adds a new empty menu item category to a restaurant. **Requires that the user is an owner of the restaurant, or is an admin.**

Expects form parameters:
|Name|Description|
|---|---|
|`name`|String name of menu item|
|`active`|`true` or `false`|

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### PUT `/restaurant/:id/category/:catindex`
Updates the data for a menu item category on a restaurant, by its index. **Requires that the user is an owner of the restaurant, or is an admin.**

Expects form parameters:
|Name|Description|
|---|---|
|`name`|String name of menu category|
|`active`|`true` or `false`|
|`move_up`|`true` or `false`. If `true`, then this category will be moved up by one in the array.|
|`move_down`|`true` or `false`. If `true`, then this category will be moved up by one in the array.|
|`items`|Stringified JSON array: list of menu item string IDs to replace existing list.|

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### DELETE `/restaurant/:id/category/:catindex`
Deletes a menu item category from a restaurant, by its index. Note: This doesn't actually delete any of the menu items contained within the category. **Requires that the user is an owner of the restaurant, or is an admin.**

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### GET `/restaurant/:id/workers`
Retrieves the list of workers at a restaurant. **Requires that the user is an owner/worker of the restaurant, or is an admin.**

If successful, produces this JSON result:
```json
{
  "success": true,
  "list": [
    <String ID of worker>,
    ...
  ]
}
```

### POST `/restaurant/:id/workers`
Adds a new worker to a restaurant, by user ID.
**Requires that the user is an owner of the restaurant, or is an admin.**

Expects form parameters:
|Name|Description|
|---|---|
|`user_email`|Email of new worker user|

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### DELETE `/restaurant/:id/workers/:workerid`
Removes a worker from a restaurant, by user ID.
**Requires that the user is an owner of the restaurant, or is an admin.**

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### DELETE `/restaurant/:id`
Deletes the restaurant with the given ID. Does not remove any menu items associated with the restaurant, however. **Requires that the user is an admin.**

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### POST `/restaurant`
Creates a new empty restaurant with the given parameters. **Requires that the user is an admin.**

Expects form parameters:
|Name|Description|
|---|---|
|`name`|String name of restaurant|
|`image`|Image data for thumbnail of restaurant|

If successful, produces this JSON result:
```json
{
  "success": true,
  "id": <String ID of restaurant>
}
```

### GET `/restaurant/:id/owners`
Retrieves the list of owners at a restaurant. **Requires that the user is an owner/worker of the restaurant, or is an admin.**

If successful, produces this JSON result:
```json
{
  "success": true,
  "list": [
    <String ID of owner>,
    ...
  ]
}
```

### POST `/restaurant/:id/owners`
Adds a new owner to a restaurant, by user ID.
**Requires that the user is an admin.**

Expects form parameters:
|Name|Description|
|---|---|
|`user_email`|Email of new owner user|

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### DELETE `/restaurant/:id/owners/:ownerid`
Removes an owner from a restaurant, by user ID.
**Requires that the user is an admin.**

If successful, produces this JSON result:
```json
{
  "success": true
}
```

### GET `/user/:id`
Gets basic information about a user, given their ID. **Requires that the current user works for/owns any restaurant (or is an admin), or that the user ID is for a user that works for/owns a restaurant (or is an admin).**

If successful, produces this JSON result:
```json
{
  "success": true,
  "name": <String>,
  "email": <String>
}
```

### GET `/session/admin`
Returns whether the current user is an admin. Do not use this to execute privileged tasks - this is just for the frontend to know.

If successful, produces this JSON result:
```json
{
  "success": true,
  "admin": <true|false>
}
```

### GET `/session/restaurant`
Returns the status of the current user with respect to a restaurant ID. Do not use this to execute privileged tasks - this is just for the frontend to know.
For admins, the `owner` status is returned.

Expects GET parameters:
|Name|Description|
|---|---|
|`id`|ID of restaurant|

If successful, produces this JSON result:
```json
{
  "success": true,
  "status": <'user'|'worker'|'owner'>
}
```

### GET `/session`
Returns the ID of the current user, as well as whether the user is a worker/owner of any restaurants (or an admin).

If successful, produces this JSON result:
```json
{
  "success": true,
  "id": <String>,
  "normal_user" <true|false>
}
```