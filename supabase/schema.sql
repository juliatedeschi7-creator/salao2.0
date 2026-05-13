-- Extensões
create extension if not exists "uuid-ossp";

-- Tabela de perfis de usuários
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  nome text not null,
  role text not null default 'cliente' 
    check (role in ('admin_geral','dono_salao','funcionario','cliente')),
  salao_id uuid,
  avatar_url text,
  aprovado boolean default false,
  created_at timestamp with time zone default now()
);

-- Tabela de salões
create table saloes (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  slug text unique not null,
  descricao text,
  telefone text,
  endereco text,
  logo_url text,
  dono_id uuid references profiles(id),
  ativo boolean default true,
  created_at timestamp with time zone default now()
);

-- Tabela de serviços
create table servicos (
  id uuid default uuid_generate_v4() primary key,
  salao_id uuid references saloes(id) on delete cascade,
  nome text not null,
  descricao text,
  duracao_minutos int not null default 60,
  preco decimal(10,2) not null,
  custo_material decimal(10,2) default 0,
  comissao_percentual decimal(5,2) default 0,
  ativo boolean default true,
  created_at timestamp with time zone default now()
);

-- Tabela de clientes dos salões
create table clientes (
  id uuid default uuid_generate_v4() primary key,
  salao_id uuid references saloes(id) on delete cascade,
  profile_id uuid references profiles(id),
  nome text not null,
  telefone text,
  email text,
  observacoes text,
  created_at timestamp with time zone default now()
);

-- Tabela de agendamentos
create table agendamentos (
  id uuid default uuid_generate_v4() primary key,
  salao_id uuid references saloes(id) on delete cascade,
  cliente_id uuid references clientes(id),
  servico_id uuid references servicos(id),
  profissional_id uuid references profiles(id),
  data_hora timestamp with time zone not null,
  duracao_minutos int not null,
  status text default 'pendente' 
    check (status in ('pendente','confirmado','concluido','cancelado')),
  valor decimal(10,2),
  observacoes text,
  horario_fixo boolean default false,
  created_at timestamp with time zone default now()
);

-- Tabela de pacotes
create table pacotes (
  id uuid default uuid_generate_v4() primary key,
  salao_id uuid references saloes(id) on delete cascade,
  nome text not null,
  descricao text,
  categoria text,
  sessoes int not null,
  validade_dias int not null,
  preco decimal(10,2) not null,
  status text default 'ativo' check (status in ('ativo','rascunho','inativo')),
  created_at timestamp with time zone default now()
);

-- Tabela de pacotes dos clientes
create table cliente_pacotes (
  id uuid default uuid_generate_v4() primary key,
  cliente_id uuid references clientes(id),
  pacote_id uuid references pacotes(id),
  sessoes_usadas int default 0,
  sessoes_total int not null,
  data_compra timestamp with time zone default now(),
  data_expiracao timestamp with time zone,
  status text default 'ativo' check (status in ('ativo','expirado','concluido'))
);

-- Tabela financeira
create table transacoes (
  id uuid default uuid_generate_v4() primary key,
  salao_id uuid references saloes(id) on delete cascade,
  tipo text not null check (tipo in ('receita','despesa')),
  categoria text,
  descricao text not null,
  valor decimal(10,2) not null,
  agendamento_id uuid references agendamentos(id),
  data_hora timestamp with time zone default now()
);

-- Tabela de estoque
create table estoque (
  id uuid default uuid_generate_v4() primary key,
  salao_id uuid references saloes(id) on delete cascade,
  nome text not null,
  categoria text,
  referencia text,
  quantidade int default 0,
  unidade text default 'unidades',
  estoque_minimo int default 5,
  created_at timestamp with time zone default now()
);

-- Tabela de convites
create table convites (
  id uuid default uuid_generate_v4() primary key,
  salao_id uuid references saloes(id),
  email text not null,
  role text not null check (role in ('dono_salao','funcionario')),
  token text unique default uuid_generate_v4()::text,
  usado boolean default false,
  aprovado boolean default false,
  created_at timestamp with time zone default now()
);

-- RLS (segurança por linha)
alter table profiles enable row level security;
alter table saloes enable row level security;
alter table servicos enable row level security;
alter table clientes enable row level security;
alter table agendamentos enable row level security;
alter table pacotes enable row level security;
alter table cliente_pacotes enable row level security;
alter table transacoes enable row level security;
alter table estoque enable row level security;
alter table convites enable row level security;

-- Políticas básicas (todos podem ler o próprio perfil)
create policy "Usuário vê próprio perfil"
  on profiles for select
  using (auth.uid() = id);

create policy "Usuário edita próprio perfil"
  on profiles for update
  using (auth.uid() = id);
