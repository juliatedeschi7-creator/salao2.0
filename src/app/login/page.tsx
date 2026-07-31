  async function handleLogin() {
    if (!email || !senha) { setErro('Preencha email e senha.'); return }
    setLoading(true); setErro('')
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password: senha
    })
    
    if (error) { 
      setErro('Erro: ' + error.message); 
      setLoading(false); 
      return 
    }
    
    if (!data.session) { 
      setErro('Sessão não retornada.'); 
      setLoading(false); 
      return 
    }

    // ALERTA DE PROVA REAL: Se aparecer essa mensagem no seu celular, 
    // significa que o Supabase aceitou a senha e a sessão EXISTE no navegador.
    alert('Login Sucesso! Usuário ID: ' + data.user.id)

    window.location.replace('/salao')
  }
