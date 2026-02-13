-- biocom.kr SEO Intelligence Dashboard (PRD v1.0) - Supabase schema
-- Source: biocom_seo_dashboard_prd.docx

create table if not exists gsc_daily_metrics (
  id bigserial primary key,
  date date not null,
  page text not null,
  query text,
  device varchar(10),
  country varchar(5),
  clicks integer default 0,
  impressions integer default 0,
  ctr decimal(8,6),
  position decimal(8,2),
  created_at timestamptz default now(),
  unique (date, page, query, device, country)
);

create table if not exists pagespeed_weekly (
  id bigserial primary key,
  measured_at timestamptz not null,
  url text not null,
  strategy varchar(10) not null,
  performance_score integer,
  seo_score integer,
  accessibility_score integer,
  lcp_ms integer,
  fcp_ms integer,
  cls decimal(6,4),
  inp_ms integer,
  ttfb_ms integer,
  created_at timestamptz default now()
);

create table if not exists ga4_daily_engagement (
  id bigserial primary key,
  date date not null,
  page_path text not null,
  sessions integer,
  users integer,
  new_users integer,
  avg_engagement_time decimal(8,2),
  bounce_rate decimal(8,4),
  scroll_depth_avg decimal(8,2),
  events_per_session decimal(8,2),
  conversions integer default 0,
  source_medium text,
  created_at timestamptz default now(),
  unique (date, page_path)
);

