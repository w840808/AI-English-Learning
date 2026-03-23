-- Run this in the Supabase SQL Editor

-- Create the saved_articles table
create table public.saved_articles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  article_data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Note: We are using a composite approach here to ensure users can only see their own data
alter table public.saved_articles enable row level security;

create policy "Users can view their own articles" 
  on public.saved_articles for select 
  using ( auth.uid() = user_id );

create policy "Users can insert their own articles" 
  on public.saved_articles for insert 
  with check ( auth.uid() = user_id );

create policy "Users can delete their own articles" 
  on public.saved_articles for delete 
  using ( auth.uid() = user_id );


-- Create the saved_vocabulary table
create table public.saved_vocabulary (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  word text not null,
  pos text,
  ipa text,
  definition text not null,
  usage_in_context text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.saved_vocabulary enable row level security;

create policy "Users can view their own vocabulary" 
  on public.saved_vocabulary for select 
  using ( auth.uid() = user_id );

create policy "Users can insert their own vocabulary" 
  on public.saved_vocabulary for insert 
  with check ( auth.uid() = user_id );

create policy "Users can delete their own vocabulary" 
  on public.saved_vocabulary for delete 
  using ( auth.uid() = user_id );
