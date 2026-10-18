import './SimpleChart.css';

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  title?: string;
  height?: number;
  showValues?: boolean;
}

export const BarChart = ({ data, title, height = 200, showValues = true }: BarChartProps) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="simple-chart bar-chart">
      {title && <h4 className="chart-title">{title}</h4>}
      <div className="chart-container" style={{ height: `${height}px` }}>
        <div className="bar-container">
          {data.map((item, index) => (
            <div className="bar-wrapper" key={index}>
              <div className="bar-fill-container">
                <div 
                  className="bar-fill"
                  style={{ 
                    height: `${(item.value / maxValue) * 100}%`,
                    background: item.color || 'var(--primary)'
                  }}
                >
                  {showValues && item.value > 0 && (
                    <span className="bar-value">{item.value}</span>
                  )}
                </div>
              </div>
              <span className="bar-label">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface LineChartProps {
  data: { label: string; value: number }[];
  title?: string;
  height?: number;
  color?: string;
}

export const LineChart = ({ data, title, height = 200, color = '#0245ae' }: LineChartProps) => {
  if (data.length === 0) {
    return (
      <div className="simple-chart line-chart">
        {title && <h4 className="chart-title">{title}</h4>}
        <div className="chart-empty">No data available</div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = 0;
  const valueRange = maxValue - minValue;
  
  const width = 100;
  const chartHeight = height - 40;
  
  const points = data.map((item, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * width;
    const y = chartHeight - ((item.value - minValue) / Math.max(valueRange, 1)) * chartHeight;
    return { x, y, value: item.value, label: item.label };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1]?.x || 0} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <div className="simple-chart line-chart">
      {title && <h4 className="chart-title">{title}</h4>}
      <div className="chart-container">
        <svg viewBox={`0 0 ${width} ${chartHeight}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#gradient-${title})`} />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} className="data-point" />
          ))}
        </svg>
        <div className="line-labels">
          {data.map((item, i) => (
            <span key={i} className="line-label">{item.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  title?: string;
  size?: number;
}

export const DonutChart = ({ data, title, size = 180 }: DonutChartProps) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="simple-chart donut-chart">
        {title && <h4 className="chart-title">{title}</h4>}
        <div className="chart-empty">No data available</div>
      </div>
    );
  }

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = data.map(item => {
    const percent = (item.value / total) * 100;
    const segment = {
      ...item,
      percent,
      dashArray: `${(percent / 100) * circumference} ${circumference}`,
      dashOffset: -offset
    };
    offset += (percent / 100) * circumference;
    return segment;
  });

  return (
    <div className="simple-chart donut-chart">
      {title && <h4 className="chart-title">{title}</h4>}
      <div className="donut-container">
        <svg width={size} height={size} viewBox="0 0 100 100">
          {segments.map((segment, i) => (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="12"
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.dashOffset}
              transform="rotate(-90 50 50)"
            />
          ))}
          <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" className="donut-total">
            <tspan fontSize="16" fontWeight="700">{total}</tspan>
            <tspan x="50" dy="14" fontSize="8" fill="var(--text-muted)">Total</tspan>
          </text>
        </svg>
        <div className="donut-legend">
          {data.map((item, i) => (
            <div className="legend-item" key={i}>
              <span className="legend-dot" style={{ background: item.color }}></span>
              <span className="legend-label">{item.label}</span>
              <span className="legend-value">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
}

export const ProgressBar = ({ label, value, max, color = 'var(--primary)' }: ProgressBarProps) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  
  return (
    <div className="progress-stat">
      <div className="progress-header">
        <span className="progress-label">{label}</span>
        <span className="progress-value">{value} / {max}</span>
      </div>
      <div className="progress-track">
        <div 
          className="progress-fill" 
          style={{ width: `${percentage}%`, background: color }}
        ></div>
      </div>
    </div>
  );
};
