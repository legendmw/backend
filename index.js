require('dotenv').config(); // Ensure this is at the top
console.log('MONGO_URI:', process.env.MONGO_URI); 
console.log('Stripe Secret Key:', process.env.STRIPE_SECRET_KEY);
console.log('JWT Secret:', process.env.JWT_SECRET);

const express = require("express");
const mongoose = require("mongoose");
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://brianmtonga592:1Brisothi20*@cluster0.4d9rw0d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require('fs');
const axios = require('axios');


const app = express();
const port = process.env.PORT || 4000;

const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);



app.use(express.json());
app.use(cors());


const PAYCHANGU_API_KEY = 'sec-test-B20iySi9oJXz2MMmADRYl64s0dXuqXBE';

app.post('/create-payment', async (req, res) => {
    try {
        const { amount, currency, email, first_name, last_name, tx_ref, callback_url, return_url, customization, meta } = req.body;

        const paymentData = {
            amount,
            currency,
            email,
            first_name,
            last_name,
            callback_url,
            return_url,
            tx_ref,
            customization,
            meta
        };

        const response = await axios.post('https://api.paychangu.com/payment', paymentData, {
            headers: {
                'Authorization': `Bearer ${PAYCHANGU_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('PayChangu response:', response.data); // Log the response data
        
        // Ensure you are sending the correct field name in the response
        const checkoutUrl = response.data.data ? response.data.data.checkout_url : null;
        res.json({ paymentUrl: checkoutUrl }); // Send the payment URL as paymentUrl

    } catch (error) {
        console.error('Error creating payment:', error.message); // Log the error message
        console.error('Error details:', error.response ? error.response.data : error); // Log detailed error info
        res.status(500).send('Error creating payment');
    }
});

  
mongoose.connect(uri, {
}).then(() => {
    console.log("Connected to MongoDB");
}).catch((error) => {
    console.error("Error connecting to MongoDB:", error.message);
});

app.get("/", (req, res) => {
    res.send("Express App is Running");
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './upload/images';
        fs.exists(dir, exist => {
            if (!exist) {
                return fs.mkdir(dir, error => cb(error, dir));
            }
            return cb(null, dir);
        });
    },
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

app.use('/images', express.static('upload/images'));

app.post("/upload", upload.single('product'), (req, res) => {
    res.json({
        success: 1,
        image_url: `https://backend-production-5954.up.railway.app/images/${req.file.filename}`
    });
});

const Product = mongoose.model("Product", {
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    available: {
        type: Boolean,
        default: true
    },
});

app.post('/addproduct', async (req, res) => {
    let products = await Product.find({});
    let id;
    if (products.length > 0) {
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id + 1;
    } else {
        id = 1;
    }
    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    });
    console.log(product);
    await product.save();
    console.log("Saved");
    res.json({
        success: true,
        name: req.body.name,
    });
});

app.post('/removeproduct', async (req, res) => {
    await Product.findOneAndDelete({ id: req.body.id });
    console.log("Removed");
    res.json({
        success: true,
        name: req.body.name
    });
});

app.get('/allproducts', async (req, res) => {
    let products = await Product.find({});
    console.log("All Products Fetched");
    res.send(products);
});

const Users = mongoose.model('Users', {
    name: {
        type: String,
    },
    email: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
    },
    cartData: {
        type: Object,
    },
    date: {
        type: Date,
        default: Date.now,
    }
});

app.post('/signup', async (req, res) => {
    let check = await Users.findOne({ email: req.body.email });
    if (check) {
        return res.status(400).json({ success: false, errors: "existing user found with same email address" });
    }
    let cart = {};
    for (let i = 0; i < 300; i++) {
        cart[i] = 0;
    }
    const user = new Users({
        name: req.body.username,
        email: req.body.email,
        password: req.body.password,
        cartData: cart,
    });

    await user.save();

    const data = {
        user: {
            id: user.id
        }
    };

    const token = jwt.sign(data, process.env.JWT_SECRET);
    res.json({ success: true, token });
});

app.post('/login', async (req, res) => {
    let user = await Users.findOne({ email: req.body.email });
    if (user) {
        const passCompare = req.body.password === user.password;
        if (passCompare) {
            const data = {
                user: {
                    id: user.id
                }
            };
            const token = jwt.sign(data, process.env.JWT_SECRET);
            res.json({ success: true, token });
        } else {
            res.json({ success: false, errors: "Wrong Password" });
        }
    } else {
        res.json({ success: false, errors: "Wrong Email Id" });
    }
});

app.get('/newcollections', async (req, res) => {
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("NewCollections Fetched");
    res.send(newcollection);
});

app.get('/popularinstationary', async (req, res) => {
    let products = await Product.find({ category: "stationary" });
    let popular_in_women = products.slice(0, 4);
    console.log("Popular in stationary Fetched");
    res.send(popular_in_women);
});

const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) {
        res.status(401).send({ errors: "Please authenticate using valid token" });
    } else {
        try {
            const data = jwt.verify(token, process.env.JWT_SECRET);
            req.user = data.user;
            next();
        } catch (error) {
            res.status(401).send({ errors: "please authenticate using a valid token" });
        }
    }
};

app.post('/addtocart', fetchUser, async (req, res) => {
    console.log("Added", req.body.itemId);
    let userData = await Users.findOne({ _id: req.user.id });
    userData.cartData[req.body.itemId] += 1;
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.send("Added");
});

app.post('/removefromcart', fetchUser, async (req, res) => {
    console.log("removed", req.body.itemId);
    let userData = await Users.findOne({ _id: req.user.id });
    if (userData.cartData[req.body.itemId] > 0)
        userData.cartData[req.body.itemId] -= 1;
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.send("removed");
});

app.get('/fetchcart', fetchUser, async (req, res) => {
    let products = await Product.find({});
    let userData = await Users.findOne({ _id: req.user.id });
    let cartArray = [];
    for (let i = 0; i < 300; i++) {
        if (userData.cartData[i] > 0) {
            let data = {
                id: i,
                name: products[i].name,
                image: products[i].image,
                category: products[i].category,
                price: products[i].new_price,
                quantity: userData.cartData[i],
            };
            cartArray.push(data);
        }
    }
    res.send(cartArray);
});

app.post('/getuser', fetchUser, async (req, res) => {
    const userId = req.user.id;
    const user = await Users.findOne({ _id: userId }).select('-password');
    res.send(user);
});

app.listen(port, () => {
    console.log(`Express App is running on port ${port}`);
});
