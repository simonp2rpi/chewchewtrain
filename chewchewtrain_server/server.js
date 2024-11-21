const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { resolve } = require('path');
const bcrypt = require('bcrypt');
const csurf = require('csurf');
const multer = require('multer');
const path = require('path');

// Initialize Firebase
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require("firebase-admin/auth");
const firebaseApp = initializeApp({
  credential: applicationDefault()
});
const firebaseAuth = getAuth(firebaseApp);

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

// parse cookies
app.use(cookieParser());

// file uploads
const upload = multer({ 
  dest: './uploads/',
  limits: {
    fileSize: 5000000,
    files: 1
  }
});

/* CSRF protection (disabled, at least for now)
app.use(csurf({ cookie: true }));
function verifyCsrf(req, res) {
  if (req.csrfToken() !== req.body._csrf) {
    res.status(401).json({ success: false, error: 'Unauthorized request.' });
    return false;
  }
  return true;
}
*/

// send static files
app.use(express.static('out'));

// mongoose schemas
const userSchema = new mongoose.Schema({
  id: String,
  name: String,
  email: String,
  auth: String,
  registered_on: Number,
  cart: [{type: String}],
  transaction_history: [{type: String}],
  admin: Boolean,
  owner_of: [{type: String}],
  worker_of: [{type: String}]
});
const User = mongoose.model('User', userSchema); 

const sessionSchema = new mongoose.Schema({
  user: String,
  session_token: String,
  time_created: Number,
  time_last_used: Number
});
const Session = mongoose.model('Session', sessionSchema);

const menuItemSchema = new mongoose.Schema({
  id: String,
  name: String,
  desc: String,
  variants: [{
    name: String,
    price_usd: String,
    id: String
  }],
  restaurant: String,
  active: Boolean
});
const MenuItem = mongoose.model('MenuItem', menuItemSchema);

const restaurantSchema = new mongoose.Schema({
  id: String,
  name: String,
  image: String,
  owners: [{type: String}],
  workers: [{type: String}],
  menu_categories: [{
    name: String,
    items: [{type: String}],
    active: Boolean
  }],
  current_transactions: [{type: String}],
  past_transactions: [{type: String}]
});
const Restaurant = mongoose.model('Restaurant', restaurantSchema);

const transactionSchema = new mongoose.Schema({
  id: String,
  items: [{
    item_id: String,
    variant_id: String,
    quantity: Number
  }],
  in_cart: Boolean,
  completed: Boolean,
  canceled: Boolean,
  time_ordered: Number,
  time_completed: Number,
  restaurant: String,
  user: String,
  workers: [{type: String}]
});
const Transaction = mongoose.model('Transaction', transactionSchema);

const feedbackSchema = new mongoose.Schema({
  id: String,
  user: String,
  feedback_type: String,
  feedback_id: String,
  message: String,
  contact: String
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

// Initialization
async function initializeServer() {
  console.log('Connecting to MongoDB...');
  try {
    await mongoose.connect(process.env.MONGODB);
    console.log('Connection established.');
  } catch (ex) {
    console.log(ex);
  }
}

// Unique ID generation
function generateUniqueId() {
  return new Promise((resolve) => {
    crypto.randomBytes(16, (err, buf) => {
      if (err !== null)
        console.log(err);
      resolve(buf.toString('hex'));
    });
  });
}

// Timestamps
function getCurrentTime() {
  return Date.now();
}
const oneDayInMilliseconds = 86400000;

// Session management
async function clearOldSessions() {
  await Session.deleteMany({ time_last_used: { $lte: getCurrentTime() - oneDayInMilliseconds }});
}
async function createNewSession(req, res) {
  const time = getCurrentTime();
  const sessionToken = await generateUniqueId();

  const dbSession = new Session({
    user: '',
    session_token: sessionToken,
    time_created: time,
    time_last_used: time
  });
  await dbSession.save();

  res.cookie('session', sessionToken, { maxAge: 604800000, httpOnly: true });
  return dbSession;
}
async function getSession(req, res) {
  // First, housekeeping on old sessions
  await clearOldSessions();

  // Check for cookie session ID
  const sessionToken = req.cookies.session;
  if (sessionToken === undefined) {
    return await createNewSession(req, res);
  }

  // Try to find existing session
  const dbSession = await Session.findOneAndUpdate({ session_token: sessionToken }, { $set: { time_last_used: getCurrentTime() } });
  if (dbSession == undefined) {
    return await createNewSession(req, res);
  }

  res.cookie('session', sessionToken, { maxAge: 604800000, httpOnly: true });
  return dbSession;
}

// Error-handling for APIs
class ExpectedValueException {
  constructor(error) {
    this.error = error;
  }
}
function expectStringParam(req, param) {
  if (typeof req.query[param] !== 'string')
    throw new ExpectedValueException(`Expected string query parameter "${param}".`);
  return req.query[param];
}
function expectStringParamForm(req, param) {
  if (typeof req.body[param] !== 'string')
    throw new ExpectedValueException(`Expected string form parameter "${param}".`);
  return req.body[param];
}
function expectIntegerParamForm(req, param) {
  if (typeof req.body[param] !== 'string')
    throw new ExpectedValueException(`Expected integer form parameter "${param}".`);
  try {
    return parseInt(req.body[param])
  } catch {
    throw new ExpectedValueException(`Expected integer for "${param}".`);
  }
}
function handleError(res, ex) {
  if (ex instanceof ExpectedValueException) {
    res.status(400).json({ success: false, error: ex.error });
    return;
  }
  console.log(ex);
  res.status(500).json({ success: false, error: 'Internal server error.' });
}

initializeServer().then(() => {
  // Authentication mechanisms
  app.post('/signin', async (req, res) => {
    let session = await getSession(req, res);
    if (session.user !== '') {
      res.status(400).json({ success: false, error: 'Already signed in.' });
      return;
    }

    try {
      const idToken = expectStringParamForm(req, 'id_token');

      let decodedToken;
      try {
        decodedToken = await firebaseAuth.verifyIdToken(idToken, true);
      } catch (ex) {
        res.status(400).json({ success: false, error: 'Failed to verify login.' });
        return;
      }

      // Try to authenticate user
      const user = await User.findOne({ auth: decodedToken.uid });
      if (user === undefined) {
        // User doesn't exist in our own database... 
        res.status(400).json({ success: false, error: 'Invalid credentials.' });
        return;
      }

      // Update session with this new user
      await session.updateOne({ $set: { user: user.id } });

      res.status(200).json({ success: true });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.post('/signup', async (req, res) => {
    let session = await getSession(req, res);
    if (session.user !== '') {
      res.status(400).json({ success: false, error: 'Already signed in.' });
      return;
    }

    try {
      const name = expectStringParamForm(req, 'name');
      const email = expectStringParamForm(req, 'email');
      const password = expectStringParamForm(req, 'password');
      const registeredOn = getCurrentTime();

      // Ensure no user currently exists
      if (await User.findOne({ email }) !== null) {
        res.status(400).json({ success: false, error: 'Account already exists.' });
        return;
      }

      // Ensure email is an RPI address
      if (process.env.ALLOW_ANY_EMAIL !== 'true') {
        if (!email.endsWith('@rpi.edu')) {
          res.status(400).json({ success: false, error: 'Only RPI emails allowed.' });
          return;
        }
        const restOfEmail = email.substring(0, email.lastIndexOf('@rpi.edu'));
        const charA = 'a'.charCodeAt(0), charZ = 'z'.charCodeAt(0), char0 = '0'.charCodeAt(0), char9 = '9'.charCodeAt(0);
        for (let i = 0; i < restOfEmail.length; i++) {
          const currChar = restOfEmail.charCodeAt(i);
          if ((currChar < charA || currChar > charZ) && (currChar < char0 || currChar > char9)) {
            res.status(400).json({ success: false, error: 'Invalid RCS ID.' });
            return;
          }
        }
      }

      firebaseAuth
        .createUser({
          email,
          emailVerified: false,
          password,
          displayName: name,
          disabled: false,
        })
        .then(async (userRecord) => {
          console.log('Successfully created new user:', userRecord.uid);

          // Create new User on our database!
          const dbUser = new User({
            name,
            email,
            registered_on: registeredOn,
            auth: userRecord.uid,
            id: await generateUniqueId(),
            admin: false,
            cart: [],
            owner_of: [],
            transaction_history: [],
            worker_of: []
          });
          await dbUser.save();

          // Update session
          await session.updateOne({ $set: { user: dbUser.id }});

          res.status(200).json({ success: true });
        })
        .catch((error) => {
          console.log('Error creating new user:', error);
          res.status(400).json({ success: false, error: 'Failed to create account.' });
        });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.post('/signout', async (req, res) => {
    let session = await getSession(req, res);
    await session.updateOne({ $set: { user: '' } });
    res.status(200).json({ success: true });
  });
  app.get('/signedin', async (req, res) => {
    let session = await getSession(req, res);
    res.status(200).json({ success: true, signed_in: (session.user !== '') });
  });

  // Get all restaurants
  app.get('/restaurant', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    let list = [];
    const restaurants = await Restaurant.find({});
    for (const restaurant of restaurants) {
      list.push({
        id: restaurant.id,
        name: restaurant.name,
        image: '/restaurant/' + restaurant.id + '/image'
      });
    }

    res.status(200).json({ success: true, list });
  });
  app.get('/restaurant/:id', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }
    
    // Find restaurant
    const id = req.params.id;
    const restaurant = await Restaurant.findOne({ id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Not found.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }
    
    // Check if we're able to see inactive items
    const canSeeInactive = 
      user.admin || user.worker_of.includes(restaurant.id) 
                 || user.owner_of.includes(restaurant.id);
    
    // Build categories
    let categories = [];
    for (const category of restaurant.menu_categories) {
      let categoryData = {};

      // Handle active status
      if (canSeeInactive) {
        categoryData.active = category.active;
      } else {
        if (!category.active) {
          continue;
        }
      }

      // Handle items
      let categoryItems = [];
      for (const itemId of category.items) {
        const item = await MenuItem.findOne({ id: itemId });
        if (item == undefined) {
          continue;
        }

        let itemData = {};
        
        // Handle active status of item
        if (canSeeInactive) {
          itemData.active = item.active;
        } else if (!item.active) {
          continue;
        }

        itemData.id = item.id;
        itemData.name = item.name;
        itemData.desc = item.desc;
        itemData.variants = [];
        for (const variant of item.variants) {
          itemData.variants.push({
            id: variant.id,
            name: variant.name,
            price_usd: variant.price_usd
          });
        }

        categoryItems.push(itemData);
      }

      // Add to list if there's any items
      if (categoryItems.length > 0 || canSeeInactive) {
        categoryData.items = categoryItems;
        categoryData.name = category.name;
        categories.push(categoryData);
      }
    }

    // Return final restaurant object
    res.status(200).json({ 
      success: true, 
      id: restaurant.id,
      name: restaurant.name, 
      image: '/restaurant/' + restaurant.id + '/image',
      categories
    });
  });
  app.get('/restaurant/:id/item/:itemid', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find restaurant
    const id = req.params.id;
    const restaurant = await Restaurant.findOne({ id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Not found.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }
    
    // Check if we're able to see inactive items
    const canSeeInactive = 
      user.admin || user.worker_of.includes(restaurant.id) 
                 || user.owner_of.includes(restaurant.id);

    // Find item in restaurant
    const itemid = req.params.itemid;
    for (const category of restaurant.menu_categories) {
      if (!canSeeInactive && !category.active) {
        continue;
      }

      if (category.items.includes(itemid)) {
        const item = await MenuItem.findOne({ id: itemid });
        if (item == undefined) {
          break;
        }

        // Return this item!
        let itemData = {};
        if (canSeeInactive) {
          itemData.active = item.active;
        } else if (!item.active) {
          break;
        }

        itemData.id = item.id;
        itemData.name = item.name;
        itemData.variants = [];
        for (const variant of item.variants) {
          itemData.variants.push({
            id: variant.id,
            name: variant.name,
            price_usd: variant.price_usd
          });
        }

        res.status(200).json({ success: true, ...itemData });
        return;
      }
    }

    res.status(404).json({ success: false, error: 'Not found.' });
  });
  app.get('/restaurant/:id/order', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find restaurant
    const id = req.params.id;
    const restaurant = await Restaurant.findOne({ id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Not found.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }
    
    // Check if we're able to view orders
    const canViewOrders = 
      user.admin || user.worker_of.includes(restaurant.id) 
                 || user.owner_of.includes(restaurant.id);
    if (!canViewOrders) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    res.status(200).json({
      success: true,
      active: restaurant.current_transactions,
      past: restaurant.past_transactions
    });
  });
  app.put('/restaurant/:id/item/:itemid', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find restaurant
    const id = req.params.id;
    const restaurant = await Restaurant.findOne({ id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Not found.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Find menu item
    const itemId = req.params.itemid;
    const menuItem = await MenuItem.findOne({ id: itemId });
    if (menuItem == undefined || menuItem.restaurant !== id) {
      res.status(404).json({ success: false, error: 'Not found.' });
      return;
    }
    
    // Check if we're able to do this
    const canUpdateActiveState = 
      user.admin || user.worker_of.includes(restaurant.id) 
                 || user.owner_of.includes(restaurant.id);
    const canUpdateItemFields =
      user.admin || user.owner_of.includes(restaurant.id);
    if (!canUpdateActiveState) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    const active = req.body.active ?? undefined;
    const name = req.body.name ?? undefined;
    const variants = req.body.variants ?? undefined;
    const desc = req.body.desc ?? undefined;

    if (!canUpdateItemFields) {
      if (name !== undefined || variants !== undefined || desc !== undefined) {
        res.status(401).json({ success: false, error: 'Unauthorized request.' });
        return;
      }
    }

    let toSet = {};
    if (active !== undefined)
      toSet.active = active;
    if (name !== undefined)
      toSet.name = name;
    if (desc !== undefined)
      toSet.desc = desc;
    if (variants !== undefined) {
      const decodedVariants = JSON.parse(variants);
      if (!Array.isArray(decodedVariants)) {
        res.status(400).json({ success: false, error: 'Expected array for "variants".' });
        return;
      }
      toSet.variants = menuItem.variants;
      for (const variant of decodedVariants) {
        if (variant.name === undefined || variant.price_usd === undefined) {
          res.status(400).json({ success: false, error: 'Expected "name" and "price_usd" for each variant in "variants".' });
          return;
        }
        toSet.variants.push({
          id: await generateUniqueId(),
          name: variant.name,
          price_usd: variant.price_usd
        });
      }
    }
    await menuItem.updateOne({ 
      $set: toSet
    });

    res.status(200).json({ success: true });
  });
  app.put('/restaurant/:id', upload.any(), async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find restaurant
    const id = req.params.id;
    const restaurant = await Restaurant.findOne({ id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Not found.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Check if we're able to do this
    const canUpdate =
      user.admin || user.owner_of.includes(restaurant.id);
    if (!canUpdate) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Name, if supplied
    if (req.body.name != undefined) {
      const name = req.body.name;
      await restaurant.updateOne({ $set: { name } });
    }
    
    // Image upload
    if (req.files != undefined && req.files.length === 1) {
      const imagePath = req.files[0].path;
      if (path.extname(req.files[0].originalname).toLowerCase() === ".png") {
        await restaurant.updateOne({ $set: { image: imagePath }});
        res.status(200).json({ success: true });
      } else {
        fs.unlink(imagePath, (error) => {
          if (error) {
            console.log(error);
            res.status(500).json({ success: false, error: 'Internal server error.' });
            return;
          }
  
          res.status(403).json({ success: false, error: "Only PNG files are allowed." });
        });
      }
    } else {
      res.status(200).json({ success: true });
    }
  });
  app.get('/restaurant/:id/image', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find restaurant
    const id = req.params.id;
    const restaurant = await Restaurant.findOne({ id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Not found.' });
      return;
    }

    // Send file!
    try {
      res.status(200).sendFile(path.join(__dirname, restaurant.image), {
        headers: { 'Content-Type': 'image/png' }
      });
    } catch (ex) {
      console.log(ex);
      res.status(500).json({ success: false, error: "Internal server error." });
    }
  });
  app.post('/restaurant/:id/item', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find restaurant
    const id = req.params.id;
    const restaurant = await Restaurant.findOne({ id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Not found.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Check if we're able to do this
    const canUpdate =
      user.admin || user.owner_of.includes(restaurant.id);
    if (!canUpdate) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    try {
      const name = expectStringParamForm(req, 'name');
      const active = expectStringParamForm(req, 'active');
      const categoryIndex = expectIntegerParamForm(req, 'category_index');
      const variants = expectStringParamForm(req, 'variants');
      const desc = expectStringParamForm(req, 'desc');

      if (active !== 'true' && active !== 'false') {
        res.status(400).json({ success: false, error: 'Expected boolean for "active".' });
        return;
      }

      if (categoryIndex < 0 || categoryIndex >= restaurant.menu_categories.length) {
        res.status(400).json({ success: false, error: 'Invalid category index supplied.' });
        return;
      }

      const decodedVariants = JSON.parse(variants);
      if (!Array.isArray(decodedVariants)) {
        res.status(400).json({ success: false, error: 'Expected array for "variants".' });
        return;
      }
      let variantArray = [];
      for (const variant of decodedVariants) {
        if (variant.name === undefined || variant.price_usd === undefined) {
          res.status(400).json({ success: false, error: 'Expected "name" and "price_usd" for each variant in "variants".' });
          return;
        }
        variantArray.push({
          id: await generateUniqueId(),
          name: variant.name,
          price_usd: variant.price_usd
        });
      }
      if (variantArray.length === 0) {
        res.status(400).json({ success: false, error: 'Expected at least one variant.' });
      }
      
      // Add menu item to database
      const menuItem = new MenuItem({
        id: await generateUniqueId(),
        name,
        active: active === 'true',
        restaurant: restaurant.id,
        variants: variantArray,
        desc
      });
      await menuItem.save();

      // Add menu item ID to category
      let categories = restaurant.menu_categories;
      categories[categoryIndex].items.push(menuItem.id);
      await restaurant.updateOne({ $set: { menu_categories: categories } });

      res.status(200).json({ success: true, id: menuItem.id });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.post('/restaurant/:id/category', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find restaurant
    const id = req.params.id;
    const restaurant = await Restaurant.findOne({ id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Not found.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Check if we're able to do this
    const canUpdate =
      user.admin || user.owner_of.includes(restaurant.id);
    if (!canUpdate) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    try {
      const name = expectStringParamForm(req, 'name');
      const active = expectStringParamForm(req, 'active');

      if (active !== 'true' && active !== 'false') {
        res.status(400).json({ success: false, error: 'Expected boolean for "active".' });
        return;
      }

      // Add new category
      let categories = restaurant.menu_categories;
      categories.push({
        name,
        active: active === 'true',
        items: []
      });
      await restaurant.updateOne({ $set: { menu_categories: categories } });

      res.status(200).json({ success: true });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.put('/restaurant/:id/category/:catindex', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find restaurant
    const id = req.params.id;
    const restaurant = await Restaurant.findOne({ id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Not found.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Check if we're able to do this
    const canUpdate =
      user.admin || user.owner_of.includes(restaurant.id);
    if (!canUpdate) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Check category index
    let categoryIndex = req.params.catindex;
    try {
      categoryIndex = parseInt(categoryIndex);
    } catch (ex) {
      categoryIndex = undefined;
    }
    if (categoryIndex === undefined || categoryIndex < 0 || categoryIndex >= restaurant.menu_categories.length) {
      res.status(400).json({ success: false, error: 'Invalid category index supplied.' });
      return;
    }

    try {
      const name = expectStringParamForm(req, 'name');
      const active = expectStringParamForm(req, 'active');
      const moveUp = expectStringParamForm(req, 'move_up');
      const moveDown = expectStringParamForm(req, 'move_down');
      const items = expectStringParamForm(req, 'items');

      if (active !== 'true' && active !== 'false') {
        res.status(400).json({ success: false, error: 'Expected boolean for "active".' });
        return;
      }
      if (moveUp !== 'true' && moveUp !== 'false') {
        res.status(400).json({ success: false, error: 'Expected boolean for "move_up".' });
        return;
      }
      if (moveDown !== 'true' && moveDown !== 'false') {
        res.status(400).json({ success: false, error: 'Expected boolean for "move_down".' });
        return;
      }

      // Verify all items belong to this restaurant
      let itemsArray = JSON.parse(items);
      if (!Array.isArray(itemsArray)) {
        res.status(400).json({ success: false, error: 'Expected array of string item IDs for "items".' });
        return;
      }
      for (const itemId of itemsArray) {
        if (typeof itemId !== 'string') {
          res.status(400).json({ success: false, error: 'Expected array of string item IDs for "items".' });
          return;
        }
        const item = await MenuItem.findOne({ id: itemId });
        if (item == undefined || item.restaurant !== restaurant.id) {
          res.status(400).json({ success: false, error: 'Expected array of string item IDs belonging to same restaurant for "items".' });
          return;
        }
      }

      // Update categories!
      let categories = restaurant.menu_categories;
      categories[categoryIndex].name = name;
      categories[categoryIndex].active = active;
      categories[categoryIndex].items = itemsArray;
      if (moveUp === 'true' && moveDown !== 'true') {
        if (categoryIndex > 0) {
          const temp = categories[categoryIndex - 1];
          categories[categoryIndex - 1] = categories[categoryIndex];
          categories[categoryIndex] = temp;
        }
      }
      if (moveDown === 'true' && moveUp !== 'true') {
        if (categoryIndex < categories.length - 1) {
          const temp = categories[categoryIndex + 1];
          categories[categoryIndex + 1] = categories[categoryIndex];
          categories[categoryIndex] = temp;
        }
      }

      // Update database
      await restaurant.updateOne({ $set: { menu_categories: categories } });

      res.status(200).json({ success: true });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.delete('/restaurant/:id/category/:catindex', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find restaurant
    const id = req.params.id;
    const restaurant = await Restaurant.findOne({ id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Not found.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Check if we're able to do this
    const canUpdate =
      user.admin || user.owner_of.includes(restaurant.id);
    if (!canUpdate) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Check category index
    let categoryIndex = req.params.catindex;
    try {
      categoryIndex = parseInt(categoryIndex);
    } catch (ex) {
      categoryIndex = undefined;
    }
    if (categoryIndex === undefined || categoryIndex < 0 || categoryIndex >= restaurant.menu_categories.length) {
      res.status(400).json({ success: false, error: 'Invalid category index supplied.' });
      return;
    }

    // Update database
    let categories = restaurant.menu_categories;
    categories.splice(categoryIndex, 1);
    await restaurant.updateOne({ $set: { menu_categories: categories } });

    res.status(200).json({ success: true });
  });

  app.post('/cart', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    try {
      const restaurantId = expectStringParamForm(req, 'restaurant');
      const itemsJson = expectStringParamForm(req, 'items');
      const items = JSON.parse(itemsJson);
      if (!Array.isArray(items)) {
        res.status(400).json({ success: false, error: 'Expected JSON array for "items".' });
        return;
      }

      // Find restaurant
      const restaurant = await Restaurant.findOne({ id: restaurantId });
      if (restaurant == undefined) {
        res.status(404).json({ success: false, error: 'Not found.' });
        return;
      }

      // Find user
      const user = await User.findOne({ id: session.user });
      if (user == undefined) {
        res.status(500).json({ success: false, error: 'Failed to find user.' });
        return;
      }

      // Ensure every item is a string, and also exists
      for (const item of items) {
        let valid = true;
        if (typeof item.item_id !== 'string')
          valid = false;
        if (typeof item.variant_id !== 'string')
          valid = false;
        if (typeof item.quantity !== 'number')
          valid = false;
        if (!valid) {
          res.status(400).json({ success: false, error: 'Expected object(s) with "item_id", "variant_id", and "quantity" inside of "items".' });
          return;
        }
        const menuItem = await MenuItem.findOne({ id: item.item_id });
        if (menuItem == undefined || menuItem.restaurant !== restaurant.id || !menuItem.active) {
          res.status(404).json({ success: false, error: 'Failed to find menu item on restaurant.' });
          return;
        }
        if (menuItem.variants.findIndex(v => v.id === item.variant_id) == -1) {
          res.status(404).json({ success: false, error: 'Failed to find menu item variant.' });
          return;
        }
        if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) {
          res.status(400).json({ success: false, error: 'Invalid quantity supplied.' });
          return;
        }
      }

      // Find cart for this restaurant, if one already exists
      let existingCartIndex = -1;
      let existingCartId = undefined;
      for (let cartIndex = 0; cartIndex < user.cart.length; cartIndex++) {
        const transactionId = user.cart[cartIndex];
        const transaction = await Transaction.findOne({ id: transactionId });
        if (transaction == undefined)
          continue;
        if (!transaction.in_cart)
          continue;
        if (transaction.restaurant !== restaurant.id)
          continue;
        existingCartIndex = cartIndex;
        existingCartId = transactionId;
        break;
      }

      // Collect list of items
      const itemsList = [];
      for (const item of items) {
        itemsList.push({
          item_id: item.item_id,
          variant_id: item.variant_id,
          quantity: item.quantity
        });
      }

      // Create new transaction
      const newTransaction = new Transaction({
        id: await generateUniqueId(),
        items: itemsList,
        in_cart: true,
        completed: false,
        time_ordered: 0,
        time_completed: 0,
        user: user.id,
        workers: [],
        restaurant: restaurant.id,
        canceled: false
      });
      await newTransaction.save();

      // Delete old transaction, if needed
      let userCart = user.cart;
      if (existingCartIndex != -1) {
        await Transaction.deleteOne({ id: existingCartId });
        userCart.splice(existingCartIndex, 1);
      }

      // Add transaction to users' cart
      userCart.push(newTransaction.id);

      // Update user object on database
      await user.updateOne({ $set: { cart: userCart } });

      res.status(200).json({ success: true, id: newTransaction.id });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.get('/cart', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    try {
      const restaurantId = expectStringParam(req, 'restaurant');

      // Find restaurant
      const restaurant = await Restaurant.findOne({ id: restaurantId });
      if (restaurant == undefined) {
        res.status(404).json({ success: false, error: 'Not found.' });
        return;
      }

      // Find user
      const user = await User.findOne({ id: session.user });
      if (user == undefined) {
        res.status(500).json({ success: false, error: 'Failed to find user.' });
        return;
      }

      // Find cart transaction, if one exists
      let existingCart = undefined;
      for (let cartIndex = 0; cartIndex < user.cart.length; cartIndex++) {
        const transactionId = user.cart[cartIndex];
        const transaction = await Transaction.findOne({ id: transactionId });
        if (transaction == undefined)
          continue;
        if (!transaction.in_cart)
          continue;
        if (transaction.restaurant !== restaurant.id)
          continue;
        existingCart = transaction; 
        break;
      }
      if (existingCart === undefined) {
        res.status(404).json({ success: false, error: 'Cart not found for given restaurant.' });
        return;
      }

      // Build item list
      const itemsList = [];
      for (const item of existingCart.items) {
        itemsList.push({
          item_id: item.item_id,
          variant_id: item.variant_id,
          quantity: item.quantity
        });
      }

      // Return result
      res.status(200).json({ 
        success: true, 
        id: existingCart.id,
        items: itemsList
      });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.put('/cart', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    try {
      const cartId = expectStringParamForm(req, 'cart_id');
      const itemsJson = expectStringParamForm(req, 'items');
      const items = JSON.parse(itemsJson);
      if (!Array.isArray(items)) {
        res.status(400).json({ success: false, error: 'Expected JSON array for "items".' });
        return;
      }

      // Find user
      const user = await User.findOne({ id: session.user });
      if (user == undefined) {
        res.status(500).json({ success: false, error: 'Failed to find user.' });
        return;
      }

      // Find cart transaction
      const cart = await Transaction.findOne({ id: cartId });
      if (cart == undefined || cart.user !== user.id || !cart.in_cart) {
        res.status(404).json({ success: false, error: 'Cart not found with given ID.' });
        return;
      }

      // Ensure every item is a string, and also exists
      for (const item of items) {
        let valid = true;
        if (typeof item.item_id !== 'string')
          valid = false;
        if (typeof item.variant_id !== 'string')
          valid = false;
        if (typeof item.quantity !== 'number')
          valid = false;
        if (!valid) {
          res.status(400).json({ success: false, error: 'Expected object(s) with "item_id", "variant_id", and "quantity" inside of "items".' });
          return;
        }
        const menuItem = await MenuItem.findOne({ id: item.item_id });
        if (menuItem == undefined || menuItem.restaurant !== cart.restaurant || !menuItem.active) {
          res.status(404).json({ success: false, error: 'Failed to find menu item on restaurant.' });
          return;
        }
        if (menuItem.variants.findIndex(v => v.id === item.variant_id) == -1) {
          res.status(404).json({ success: false, error: 'Failed to find menu item variant.' });
          return;
        }
        if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) {
          res.status(400).json({ success: false, error: 'Invalid quantity supplied.' });
          return;
        }
      }
      
      // Collect list of items
      const itemsList = [];
      for (const item of items) {
        itemsList.push({
          item_id: item.item_id,
          variant_id: item.variant_id,
          quantity: item.quantity
        });
      }

      // Update database
      await cart.updateOne({ $set: { items: itemsList } });

      // Return result
      res.status(200).json({ success: true });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.post('/order', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    try {
      const cartId = expectStringParamForm(req, 'cart_id');

      // Find user
      const user = await User.findOne({ id: session.user });
      if (user == undefined) {
        res.status(500).json({ success: false, error: 'Failed to find user.' });
        return;
      }

      // Find cart transaction
      const cart = await Transaction.findOne({ id: cartId });
      if (cart == undefined || cart.user !== user.id || !cart.in_cart) {
        res.status(404).json({ success: false, error: 'Cart not found with given ID.' });
        return;
      }

      // Find restaurant
      const restaurant = await Restaurant.findOne({ id: cart.restaurant });
      if (restaurant == undefined) {
        res.status(404).json({ success: false, error: 'Failed to find restaurant.' });
        return;
      }

      // Verify that all items in the cart exist and are still active
      for (const item of cart.items) {
        const dbItem = await MenuItem.findOne({ id: item.item_id });
        if (dbItem == undefined || !dbItem.active) {
          res.status(404).json({ success: false, error: 'One or more items in cart do not currently exist.' });
          return;
        }
        if (dbItem.variants.findIndex(v => v.id === item.variant_id) == -1) {
          res.status(404).json({ success: false, error: 'Failed to find menu item variant.' });
          return;
        }
      }

      // Remove transaction from user's cart, and put into history
      const userCart = user.cart;
      const cartRemovalIndex = userCart.findIndex(c => c == cart.id);
      if (cartRemovalIndex == -1) {
        res.status(500).json({ success: false, error: 'Internal server error. Failed to remove cart transaction.' });
        return;
      }
      userCart.splice(cartRemovalIndex, 1);
      const userHistory = user.transaction_history;
      userHistory.push(cart.id);
      await user.updateOne({ 
        $set: { 
          cart: userCart,
          transaction_history: userHistory
        }
      });

      // Update transaction info to no longer be in cart
      await cart.updateOne({ 
        $set: {
          time_ordered: getCurrentTime(),
          in_cart: false
        }
      });

      // Update list of orders on restaurant
      const currentTransactions = restaurant.current_transactions;
      currentTransactions.push(cart.id);
      await restaurant.updateOne({
        $set: {
          current_transactions: currentTransactions
        }
      });

      res.status(200).json({ success: true });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.get('/order', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Construct lists of active/past transactions
    const activeList = [];
    const pastList = [];
    for (const transactionId of user.transaction_history) {
      const transaction = await Transaction.findOne({ id: transactionId });
      if (transaction == undefined)
        continue;

      if (transaction.completed || transaction.canceled) {
        pastList.push(transactionId);
      } else {
        activeList.push(transactionId);
      }
    }

    res.status(200).json({
      success: true,
      active: activeList,
      past: pastList
    });
  });
  app.get('/order/:id', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Find transaction
    const transaction = await Transaction.findOne({ id: req.params.id });
    if (transaction == undefined || transaction.in_cart) {
      res.status(404).json({ success: false, error: 'Order not found with given ID.' });
      return;
    }

    // Find restaurant
    const restaurant = await Restaurant.findOne({ id: transaction.restaurant });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Failed to find restaurant for order.' });
      return;
    }

    // Check if we're allowed to see this
    let allowedToSee = false;
    if (transaction.user === user.id)
      allowedToSee = true;
    if (user.admin)
      allowedToSee = true;
    if (restaurant.workers.includes(user.id) || restaurant.owners.includes(user.id))
      allowedToSee = true;
    if (!allowedToSee) {
      res.status(404).json({ success: false, error: 'Order not found with given ID.' });
      return;
    }

    // Build item list
    const itemsList = [];
    for (const item of transaction.items) {
      itemsList.push({
        item_id: item.item_id,
        variant_id: item.variant_id,
        quantity: item.quantity
      });
    }

    // Send result!
    res.status(200).json({
      success: true,
      id: transaction.id,
      items: itemsList,
      completed: transaction.completed,
      canceled: transaction.canceled,
      time_ordered: transaction.time_ordered,
      time_completed: transaction.time_completed,
      restaurant: restaurant.id,
      user: user.id,
      workers: transaction.workers
    });
  });
  app.put('/order/:id', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Find transaction
    const transaction = await Transaction.findOne({ id: req.params.id });
    if (transaction == undefined || transaction.in_cart) {
      res.status(404).json({ success: false, error: 'Order not found with given ID.' });
      return;
    }

    // Find restaurant
    const restaurant = await Restaurant.findOne({ id: transaction.restaurant });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Failed to find restaurant for order.' });
      return;
    }

    // Check if we're allowed to do this
    let allowedToDo = false;
    if (user.admin)
      allowedToDo = true;
    if (restaurant.workers.includes(user.id) || restaurant.owners.includes(user.id))
      allowedToDo = true;
    if (!allowedToDo) {
      res.status(400).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    try {
      const remove = expectStringParamForm(req, 'remove');
      if (remove !== 'true' && remove !== 'false') {
        res.status(400).json({ success: false, error: 'Expected "remove" boolean parameter.' });
        return;
      }

      // Update list
      const workerList = transaction.workers;
      if (remove === 'true') {
        const index = workerList.indexOf(user.id);
        if (index >= 0)
          workerList.splice(index, 1);
      } else {
        if (!workerList.includes(user.id))
          workerList.push(user.id);
      }
      await transaction.updateOne({ '$set': { workers: workerList }});
      
      res.status(200).json({ success: true });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.delete('/order/:id', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Find transaction
    const transaction = await Transaction.findOne({ id: req.params.id });
    if (transaction == undefined || transaction.in_cart) {
      res.status(404).json({ success: false, error: 'Order not found with given ID.' });
      return;
    }

    // Find restaurant
    const restaurant = await Restaurant.findOne({ id: transaction.restaurant });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Failed to find restaurant for order.' });
      return;
    }

    // Check if we're allowed to do this
    let allowedToDo = false;
    if (user.admin)
      allowedToDo = true;
    if (restaurant.workers.includes(user.id) || restaurant.owners.includes(user.id))
      allowedToDo = true;
    if (!allowedToDo && transaction.user !== user.id) {
      res.status(400).json({ success: false, error: 'Unauthorized request.' });
      return;
    }
    let shouldCancel = !allowedToDo;

    // Make sure transaction isn't already completed or canceled
    if (transaction.completed || transaction.canceled) {
      res.status(200).json({ success: true });
      return;
    }

    // Update transaction
    if (shouldCancel) {
      await transaction.updateOne({
        $set: {
          canceled: true,
          time_completed: getCurrentTime()
        }
      });
    } else {
      await transaction.updateOne({
        $set: {
          completed: true,
          time_completed: getCurrentTime()
        }
      });
    }

    // Move transaction to past transactions in restaurant
    const activeList = restaurant.current_transactions;
    const pastList = restaurant.past_transactions;
    const activeIndex = activeList.findIndex(t => t === transaction.id);
    if (activeIndex === -1) {
      res.status(500).json({ success: false, error: 'Internal server error. Failed to find in active list.' });
      return;
    }
    activeList.splice(activeIndex, 1);
    pastList.push(transaction.id);
    await restaurant.updateOne({
      $set: {
        current_transactions: activeList,
        past_transactions: pastList
      }
    });

    res.status(200).json({ success: true });
  });
  app.delete('/restaurant/:id', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Check permissions
    if (!user.admin) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find restaurant
    const restaurant = await Restaurant.findOne({ id: req.params.id });
    if (restaurant == undefined) {
      res.status(200).json({ success: true });
      return;
    }

    // Chaos
    await restaurant.deleteOne();

    res.status(200).json({ success: true });
  });
  app.post('/restaurant', upload.any(), async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Check if we're able to do this
    if (!user.admin) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    try {
      // Name
      const name = expectStringParamForm(req, 'name');
      
      // Image upload
      if (req.files == undefined || req.files.length !== 1) {
        res.status(400).json({ success: false, error: 'Expected file upload.' });
        return;
      }
      const imagePath = req.files[0].path;
      if (path.extname(req.files[0].originalname).toLowerCase() !== ".png") {
        fs.unlink(imagePath, (error) => {
          if (error) {
            console.log(error);
            res.status(500).json({ success: false, error: 'Internal server error.' });
            return;
          }

          res.status(403).json({ success: false, error: "Only PNG files are allowed." });
        });
        return;
      }

      const restaurant = new Restaurant({
        id: await generateUniqueId(),
        name,
        image: imagePath,
        current_transactions: [],
        past_transactions: [],
        menu_categories: [],
        owners: [],
        workers: []
      });
      await restaurant.save();

      res.status(200).json({ success: true, id: restaurant.id });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.get('/restaurant/:id/workers', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Find restaurant
    const restaurant = await Restaurant.findOne({ id: req.params.id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    // Check permissions
    if (!user.worker_of.includes(restaurant.id) && 
        !user.owner_of.includes(restaurant.id) && !user.admin) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Return result!
    res.status(200).json({
      success: true,
      list: restaurant.workers
    });
  });
  app.get('/restaurant/:id/owners', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Find restaurant
    const restaurant = await Restaurant.findOne({ id: req.params.id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    // Check permissions
    if (!user.worker_of.includes(restaurant.id) && 
        !user.owner_of.includes(restaurant.id) && !user.admin) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Return result!
    res.status(200).json({
      success: true,
      list: restaurant.owners
    });
  });
  app.post('/restaurant/:id/workers', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Find restaurant
    const restaurant = await Restaurant.findOne({ id: req.params.id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    // Check permissions
    if (!user.owner_of.includes(restaurant.id) && !user.admin) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    try {
      const userEmailToAdd = expectStringParamForm(req, 'user_email');

      // Find user
      const userToAdd = await User.findOne({ email: userEmailToAdd });
      if (userToAdd == undefined) {
        res.status(404).json({ success: false, error: 'User not found.' });
        return;
      }
      const userIdToAdd = userToAdd.id;

      // Exit early if this user ID is already on restaurant
      if (restaurant.workers.includes(userIdToAdd)) {
        res.status(200).json({ success: true });
        return;
      }

      // Add to workers list
      const workers = restaurant.workers;
      workers.push(userToAdd.id);
      await restaurant.updateOne({ $set: { workers } });

      // Update user
      const workerOf = userToAdd.worker_of;
      workerOf.push(restaurant.id);
      await userToAdd.updateOne({ $set: { worker_of: workerOf } });

      res.status(200).json({ success: true });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.post('/restaurant/:id/owners', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Find restaurant
    const restaurant = await Restaurant.findOne({ id: req.params.id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    // Check permissions
    if (!user.admin) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    try {
      const userEmailToAdd = expectStringParamForm(req, 'user_email');

      // Find user
      const userToAdd = await User.findOne({ email: userEmailToAdd });
      if (userToAdd == undefined) {
        res.status(404).json({ success: false, error: 'User not found.' });
        return;
      }
      const userIdToAdd = userToAdd.id;

      // Exit early if this user ID is already on restaurant
      if (restaurant.owners.includes(userIdToAdd)) {
        res.status(200).json({ success: true });
        return;
      }

      // Add to owners list
      const owners = restaurant.owners;
      owners.push(userToAdd.id);
      await restaurant.updateOne({ $set: { owners } });

      // Update user
      const ownerOf = userToAdd.owner_of;
      ownerOf.push(restaurant.id);
      await userToAdd.updateOne({ $set: { owner_of: ownerOf } });

      res.status(200).json({ success: true });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.delete('/restaurant/:id/workers/:workerid', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Find restaurant
    const restaurant = await Restaurant.findOne({ id: req.params.id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    // Check permissions
    if (!user.owner_of.includes(restaurant.id) && !user.admin) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const userIdToRemove = req.params.workerid;
    const userToRemove = await User.findOne({ id: userIdToRemove });
    if (userToRemove == undefined) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    // Exit early if this user ID is not on restaurant
    if (!restaurant.workers.includes(userIdToRemove)) {
      res.status(200).json({ success: true });
      return;
    }

    // Remove from workers list
    const workers = restaurant.workers;
    workers.splice(workers.indexOf(userIdToRemove), 1);
    await restaurant.updateOne({ $set: { workers } });

    // Update user
    const workerOf = userToRemove.worker_of;
    workerOf.splice(workerOf.indexOf(restaurant.id), 1);
    await userToRemove.updateOne({ $set: { worker_of: workerOf } });

    res.status(200).json({ success: true });
  });
  app.delete('/restaurant/:id/owners/:ownerid', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Find restaurant
    const restaurant = await Restaurant.findOne({ id: req.params.id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    // Check permissions
    if (!user.admin) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const userIdToRemove = req.params.ownerid;
    const userToRemove = await User.findOne({ id: userIdToRemove });
    if (userToRemove == undefined) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    // Exit early if this user ID is not on restaurant
    if (!restaurant.owners.includes(userIdToRemove)) {
      res.status(200).json({ success: true });
      return;
    }

    // Remove from owners list
    const owners = restaurant.owners;
    owners.splice(owners.indexOf(userIdToRemove), 1);
    await restaurant.updateOne({ $set: { owners } });

    // Update user
    const ownerOf = userToRemove.owner_of;
    ownerOf.splice(ownerOf.indexOf(restaurant.id), 1);
    await userToRemove.updateOne({ $set: { owner_of: ownerOf } });

    res.status(200).json({ success: true });
  });



  app.get('/user/:id', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Find requested user
    const requestedUserId = req.params.id;
    const requestedUser = await User.findOne({ id: requestedUserId });
    if (requestedUser == undefined) {
      res.status(404).json({ success: false, error: 'User not found.'} );
      return;
    }

    // Check permissions
    const needPermissionToSee = 
      (requestedUser.worker_of.length === 0 && requestedUser.owner_of.length === 0 &&
       !requestedUser.admin);
    if (needPermissionToSee && !user.admin && user.worker_of.length == 0 && 
        user.owner_of.length == 0) {
      res.status(404).json({ success: false, error: 'User not found.'} );
      return;
    }

    // Return info!
    res.status(200).json({
      success: true,
      name: requestedUser.name,
      email: requestedUser.email
    });
  });
  app.get('/session/admin', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Result
    res.status(200).json({
      success: true,
      admin: user.admin
    });
  });
  app.get('/session/restaurant', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    try {
      const restaurantId = expectStringParam(req, 'id');

      // Find restaurant
      const restaurant = await Restaurant.findOne({ id: restaurantId });
      if (restaurant == undefined) {
        res.status(404).json({ success: false, error: 'Restaurant not found.' });
        return;
      }

      let status = 'user';
      if (restaurant.workers.includes(user.id)) {
        status = 'worker';
      }
      if (user.admin || restaurant.owners.includes(user.id)) {
        status = 'owner';
      }

      // Result
      res.status(200).json({
        success: true,
        status
      });
    } catch (ex) {
      handleError(res, ex);
    }
  });
  app.get('/session', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Result
    res.status(200).json({
      success: true,
      id: user.id,
      normal_user: !user.admin && user.worker_of.length === 0 && user.owner_of.length === 0
    });
  });

   /*
   -------------------------------------
  |                                     |                 
  |              Feedback               |
  |                                     |
   -------------------------------------
  */
  app.get('/restaurant/:id/feedback', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Find restaurant
    const restaurant = await Restaurant.findOne({ id: req.params.id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    // Check permissions
    if (!user.worker_of.includes(restaurant.id) && 
        !user.owner_of.includes(restaurant.id) && !user.admin) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    let allFeedback = await Feedback.find({feedback_id: restaurant.id});

    res.status(200).json({
      success: true,
      list: allFeedback
    });
  });

  app.delete('/restaurant/:id/feedback/:fid', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    // Find user
    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    // Find restaurant
    const restaurant = await Restaurant.findOne({ id: req.params.id });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    // Check permissions
    if (!user.worker_of.includes(restaurant.id) && 
        !user.owner_of.includes(restaurant.id) && !user.admin) {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    await Feedback.deleteOne({id: req.params.fid});

    res.status(200).json({ success: true }); // return success regardless of whether anything deleted
  });

  app.post('/feedback', async (req, res) => {
    const session = await getSession(req, res);
    if (session.user === '') {
      res.status(401).json({ success: false, error: 'Unauthorized request.' });
      return;
    }

    const user = await User.findOne({ id: session.user });
    if (user == undefined) {
      res.status(500).json({ success: false, error: 'Failed to find user.' });
      return;
    }

    const restaurant = await Restaurant.findOne({ name: req.body.restaurant });
    if (restaurant == undefined) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    const uid = await generateUniqueId();
    const newFeedback = new Feedback({ 
      id: uid, 
      user: session.user, 
      feedback_type: req.body.type, 
      feedback_id: restaurant.id, 
      message: req.body.feedback, 
      contact: req.body.email
    });
    await newFeedback.save();

    res.status(200).json({ success: true });
  });

  app.put('/user/update-name', async (req, res) => {
    // Get session
    const session = await getSession(req, res);
    if (!session.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized request.' });
    }
  
    // Get the new name 
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required.' });
    }
  
    // Find user 
    const currentUser = await User.findOne({ id: session.user });
    if (!currentUser) {
        return res.status(500).json({ success: false, error: 'User not found.' });
    }
  
    // Update the user's name
    try {
        const updatedUser = await User.findByIdAndUpdate(currentUser._id, { $set: { name: name } }, { new: true });
        if (updatedUser) {
            res.status(200).json({ success: true, message: 'Name updated successfully', name: updatedUser.name });
        } else {
            res.status(404).json({ success: false, error: 'User not found.' });
        }
    } catch (error) {
        console.error('Error updating user name:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
  

  app.listen(port, () => {
    console.log(`Listening on *:${port}`);
  });
});
