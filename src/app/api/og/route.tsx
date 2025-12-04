import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Get parameters from URL
  const title = searchParams.get('title') || 'The Dailicle';
  const subtitle = searchParams.get('subtitle') || 'One Transformative Essay Every Day';
  const category = searchParams.get('category') || '';
  const readTime = searchParams.get('readTime') || '';
  
  // Brand colors (Wooden/Study theme)
  const bgColor = '#F5F2EB';
  const fgColor = '#3E2723';
  const accentColor = '#5D4037';
  
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bgColor,
          fontFamily: 'Georgia, serif',
          padding: '60px',
        }}
      >
        {/* Decorative border */}
        <div
          style={{
            position: 'absolute',
            top: '40px',
            left: '40px',
            right: '40px',
            bottom: '40px',
            border: `3px solid ${fgColor}`,
            borderRadius: '4px',
          }}
        />
        
        {/* Book Icon */}
        <div
          style={{
            display: 'flex',
            marginBottom: '40px',
          }}
        >
          <svg
            width="120"
            height="120"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g stroke={fgColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 75 L15 32 Q25 25 49 30 L49 75 Z" />
              <path d="M85 75 L85 32 Q75 25 51 30 L51 75 Z" />
              <line x1="50" y1="28" x2="50" y2="75" />
              <line x1="22" y1="40" x2="42" y2="40" strokeWidth="2" />
              <line x1="22" y1="50" x2="38" y2="50" strokeWidth="2" />
              <line x1="22" y1="60" x2="44" y2="60" strokeWidth="2" />
              <line x1="58" y1="40" x2="78" y2="40" strokeWidth="2" />
              <line x1="62" y1="50" x2="78" y2="50" strokeWidth="2" />
              <line x1="58" y1="60" x2="78" y2="60" strokeWidth="2" />
            </g>
          </svg>
        </div>
        
        {/* Category Badge */}
        {category && (
          <div
            style={{
              color: accentColor,
              fontSize: '20px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              marginBottom: '16px',
            }}
          >
            {category}
          </div>
        )}
        
        {/* Title */}
        <div
          style={{
            color: fgColor,
            fontSize: '56px',
            fontWeight: 'bold',
            textAlign: 'center',
            maxWidth: '1000px',
            lineHeight: 1.2,
            marginBottom: '20px',
          }}
        >
          {title}
        </div>
        
        {/* Subtitle */}
        <div
          style={{
            color: accentColor,
            fontSize: '28px',
            textAlign: 'center',
            maxWidth: '800px',
            marginBottom: '40px',
          }}
        >
          {subtitle}
        </div>
        
        {/* Reading time */}
        {readTime && (
          <div
            style={{
              color: accentColor,
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            ☕ {readTime} min read
          </div>
        )}
        
        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            color: fgColor,
            fontSize: '18px',
            letterSpacing: '2px',
          }}
        >
          THE DAILICLE
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
