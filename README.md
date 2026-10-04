# BookWise 📚

BookWise is an ML-driven book recommendation platform designed to help readers discover their next favorite book. The platform features a dual-backend architecture, combining a high-performance Node.js server with a Python Machine Learning engine to provide deeply personalized recommendations.

## 🚀 Features

-   **Intelligent Recommendations**: Uses Collaborative Filtering (Cosine Similarity) and ALS,Weighted Rating algorithms to suggest books tailored to user tastes.
-   **Interactive Discovery**: Dynamic genre carousels, top-rated collections, and a robust search system.
-   **User Ecosystem**: Personalized profiles, rating systems, and authentication.
-   **Admin Dashboard**: Full control over the book library, user management, and real-time analytics.
-   **Automated Assets**: Built-in logic to generate unique SVG covers for books without thumbnails.
-   **Premium UI**: A responsive, modern interface built with React, Tailwind CSS, and Shadcn UI.

---

## 🛠️ Tech Stack

### Frontend
-   **Framework**: React (Vite)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS / Shadcn UI
-   **State Management**: React Context API

### Backend (Operational)
-   **Runtime**: Node.js
-   **Framework**: Express
-   **Database**: MongoDB (Mongoose)
-   **Authentication**: JWT (JSON Web Tokens)

### Backend (Intelligence)
-   **Language**: Python
-   **Framework**: Flask
-   **Data Analysis**: Pandas, Scikit-Learn

---

## 📦 Installation & Setup

### Prerequisites
-   Node.js (v16+)
-   Python (v3.8+)
-   MongoDB (Running locally or via Atlas)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/BookWise.git
cd BookWise
```

### 2. Backend Setup
```bash
cd backend
npm install
# Create a .env file with MONGODB_URI and JWT_SECRET
npm run dev
```

### 3. ML Backend Setup
```bash
cd ml-backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📄 License
This project is for educational purposes as part of the BookWise project suite.
