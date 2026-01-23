import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getThemeColors } from '../utils/themeColors';

const LoginPage: React.FC = () => {
  const { signInWithGoogle, error } = useAuth();
  const colors = getThemeColors(false);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgPrimary,
        padding: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          maxWidth: 400,
          width: '100%',
        }}
      >
        {/* Logo and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img 
            src="https://img.icons8.com/?size=96&id=3IgibUo37hPA&format=png" 
            alt="ParentSquare Logo" 
            style={{ height: 32, width: 32 }}
          />
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: colors.textPrimary,
              margin: 0,
            }}
          >
            Hill Charts
          </h1>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: colors.errorBg,
              border: `1px solid ${colors.errorBorder}`,
              borderRadius: 8,
              color: colors.errorText,
              fontSize: 14,
              textAlign: 'center',
              width: '100%',
            }}
          >
            {error}
          </div>
        )}

        {/* Sign In Button */}
        <button
          type="button"
          onClick={signInWithGoogle}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '12px 24px',
            backgroundColor: '#ffffff',
            border: '1px solid #dadce0',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 500,
            color: '#3c4043',
            cursor: 'pointer',
            width: '100%',
            maxWidth: 280,
            transition: 'background-color 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* Google Logo */}
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
            />
            <path
              fill="#34A853"
              d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.26c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9.003 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.712A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.33z"
            />
            <path
              fill="#EA4335"
              d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
            />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
