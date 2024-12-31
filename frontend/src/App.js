import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import axios from 'axios';

const Login = ({ isLoggedIn }) => {
  if (isLoggedIn) {
    return (
      <div>
        <h1>Welcome</h1>
        <p>You are logged in!</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Login</h1>
      <p>Please log in to continue:</p>
      <a href="http://localhost:3001/login">Login with Discourse</a>
    </div>
  );
};

const Profile = ({ user }) => {
  if (!user) {
    return <Navigate to="/" />;
  }

  return (
    <div>
      <h1>Welcome, {user.username}</h1>
      <p>ID: {user.id}</p>
      <p>Email: {user.email}</p>
      <a href="http://localhost:3001/logout">Logout</a>
    </div>
  );
};

const RegisterSubdomain = ({ user }) => {
  const [subdomain, setSubdomain] = useState('');
  const [domain, setDomain] = useState('');
  const [message, setMessage] = useState('');

  if (!user) {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        'http://localhost:3001/api/register-subdomain',
        { userId: user.id, subdomain, domain },
        { withCredentials: true }
      );
      setMessage(`Subdomain registered successfully. Record ID: ${response.data.recordId}`);
    } catch (error) {
      setMessage(`Error: ${error.response?.data?.error || error.message}`);
    }
  };

  return (
    <div>
      <h1>Register Subdomain</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Subdomain:
          <input
            type="text"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)}
            required
          />
        </label>
        <label>
          Choose a domain ending:
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            required
          >
            <option value="">Select a domain</option>
            <option value="a">a</option>
            <option value="b">b</option>
          </select>
        </label>
        <button type="submit">Submit</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

const AdminPage = ({ user }) => {
  if (user && user.id === '1') {
    return (
      <div>
        <h1>Admin Panel</h1>
        <nav>
        <Link to="/admin/site">Manage Site</Link> |{' '}
          <Link to="/admin/domain">Manage Domain</Link> |{' '}
          <Link to="/admin/subdomain">Manage Subdomain</Link>
        </nav>
      </div>
    );
  }
  return <Navigate to="/" />;
};

const AdminSite = ({ user }) => {
  if (user && user.id === '1') {
    return (
      <div>
        <Link to="/admin">Return</Link>
        <h1>Manage Site</h1>
      </div>
    );
  }
  return <Navigate to="/" />;
};

const AdminDomain = ({ user }) => {
  if (user && user.id === '1') {
    return (
      <div>
        <Link to="/admin">Return</Link>
        <h1>Manage Domains</h1>
      </div>
    );
  }
  return <Navigate to="/" />;
};

const AdminSubdomain = ({ user }) => {
  if (user && user.id === '1') {
    return (
      <div>
        <Link to="/admin">Return</Link>
        <h1>Manage Subdomains</h1>
      </div>
    );
  }
  return <Navigate to="/" />;
};

const App = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    axios
      .get('http://localhost:3001/profile', { withCredentials: true })
      .then(response => {
        setUser(response.data);
        setIsLoading(false);
      })
      .catch(() => {
        setUser(null);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return <div>Loading user data...</div>;
  }

  const navigation = (
    <nav>
      <Link to="/">Home</Link> | <Link to="/profile">Profile</Link> |{' '}
      <Link to="/register">Register Subdomain</Link>
      {user && user.id === '1' && (
        <>
          {' | '}
          <Link to="/admin">Admin</Link>
        </>
      )}
    </nav>
  );

  return (
    <Router>
      <div style={{ padding: '20px' }}>
        {navigation}
        <hr />
        <Routes>
          <Route path="/" element={<Login isLoggedIn={!!user} />} />
          <Route path="/profile" element={<Profile user={user} />} />
          <Route path="/register" element={<RegisterSubdomain user={user} />} />
          <Route path="/admin" element={<AdminPage user={user} />} />
          <Route path="/admin/site" element={<AdminSite user={user} />} />
          <Route path="/admin/domain" element={<AdminDomain user={user} />} />
          <Route path="/admin/subdomain" element={<AdminSubdomain user={user} />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
