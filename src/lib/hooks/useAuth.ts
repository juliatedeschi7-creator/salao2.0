// Substitua o seu AuthProvider atual por este bloco otimizado:

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    // Reduzimos o timer de segurança para 1.5 segundo para evitar que a tela preta trave por muito tempo
    const safetyTimer = setTimeout(() => {
      if (isMounted && loading) setLoading(false)
    }, 1500)

    async function carregarSessao() {
      try {
        // Usamos getUser() em vez de apenas getSession() para validar o token no servidor com segurança e rapidez
        const { data: { user: currentUser }, error } = await supabase.auth.getUser()
        if (!isMounted) return

        if (error || !currentUser) {
          setUser(null)
          setProfile(null)
          setLoading(false)
          clearTimeout(safetyTimer)
          return
        }

        setUser(currentUser)

        const { data: prof } = await supabase
          .from('profiles').select('*').eq('id', currentUser.id).maybeSingle()
        
        if (isMounted) {
          setProfile(prof || { id: currentUser.id, nome: currentUser.email?.split('@')[0] || 'Usuário' })
        }
      } catch (e) {
        console.error('Erro ao carregar sessão:', e)
      } finally {
        if (isMounted) { 
          setLoading(false) 
          clearTimeout(safetyTimer) 
        }
      }
    }

    carregarSessao()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return
      const currentUser = session?.user ?? null
      setUser(currentUser)
      
      if (currentUser) {
        const { data: prof } = await supabase
          .from('profiles').select('*').eq('id', currentUser.id).maybeSingle()
        if (isMounted) setProfile(prof || { id: currentUser.id, nome: currentUser.email?.split('@')[0] || 'Usuário' })
      } else {
        if (isMounted) setProfile(null)
      }
      if (isMounted) { 
        setLoading(false)
        clearTimeout(safetyTimer) 
      }
    })

    return () => { isMounted = false; clearTimeout(safetyTimer); subscription.unsubscribe() }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null)
    router.push('/login')
  }

  const temAcessoTotal =
    profile?.role === 'dono_salao' ||
    (profile?.role === 'funcionario' && profile?.nivel_acesso === 'total')

  return React.createElement(
    AuthContext.Provider,
    { value: { user, profile, loading, temAcessoTotal, signOut, logout: signOut } },
    children
  )
}
