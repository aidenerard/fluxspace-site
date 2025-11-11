import { createServiceClient } from '../lib/supabase'

async function seed() {
  const supabase = createServiceClient()

  console.log('🌱 Seeding database...')

  // Create demo user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'demo@fluxspace.com',
    password: 'demo123',
    email_confirm: true,
  })

  if (authError) {
    console.error('Error creating auth user:', authError)
    return
  }

  const userId = authData.user.id
  console.log('✅ Created auth user:', userId)

  // Create user record
  const { error: userError } = await supabase
    .from('users')
    .insert({
      id: userId,
      email: 'demo@fluxspace.com',
      name: 'Demo User',
    })

  if (userError) {
    console.error('Error creating user record:', userError)
    return
  }

  console.log('✅ Created user record')

  // Create sample project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: 'Sample Bridge Inspection',
    })
    .select()
    .single()

  if (projectError) {
    console.error('Error creating project:', projectError)
    return
  }

  console.log('✅ Created project:', project.id)

  // Create sample upload
  const { data: upload, error: uploadError } = await supabase
    .from('uploads')
    .insert({
      project_id: project.id,
      filename: 'bridge_flight_001.csv',
      size_bytes: 1024000,
      storage_url: `${userId}/uploads/bridge_flight_001.csv`,
    })
    .select()
    .single()

  if (uploadError) {
    console.error('Error creating upload:', uploadError)
    return
  }

  console.log('✅ Created upload:', upload.id)

  // Create sample job (completed)
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      project_id: project.id,
      upload_id: upload.id,
      status: 'done',
      params: {
        colorRamp: 'viridis',
        gridResolution: 0.25,
        filterType: 'lowpass',
      },
      result_tif_url: `${userId}/results/bridge_001_anomaly.tif`,
      result_png_url: `${userId}/results/bridge_001_preview.png`,
      result_csv_url: `${userId}/results/bridge_001_gridded.csv`,
      logs: 'Processing completed successfully. 45,231 data points processed. Grid resolution: 25cm. Time elapsed: 127s.',
    })
    .select()
    .single()

  if (jobError) {
    console.error('Error creating job:', jobError)
    return
  }

  console.log('✅ Created job:', job.id)

  // Create usage counter
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
  const { error: usageError } = await supabase
    .from('usage_counters')
    .insert({
      user_id: userId,
      month: currentMonth,
      jobs_used: 1,
      storage_used_bytes: 1024000,
    })

  if (usageError) {
    console.error('Error creating usage counter:', usageError)
    return
  }

  console.log('✅ Created usage counter')

  console.log('\n🎉 Seeding completed!')
  console.log('\nDemo credentials:')
  console.log('Email: demo@fluxspace.com')
  console.log('Password: demo123')
  console.log('\nYou can now sign in and view the sample project.')
}

seed().catch(console.error)
