// GET: 获取文件列表
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const raw = url.searchParams.get("limit");
  let limit = parseInt(raw || "100", 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 100;
  if (limit > 1000) limit = 1000;

  const cursor = url.searchParams.get("cursor") || undefined;
  const prefix = url.searchParams.get("prefix") || undefined;
  const value = await env.img_url.list({ limit, cursor, prefix });

  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" }
  });
}

// POST: 批量删除文件（支持按文件夹筛选）
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { folder, fileIds } = await request.json();
    
    let deletedCount = 0;
    let failedCount = 0;
    
    if (fileIds && Array.isArray(fileIds)) {
      // 删除指定文件列表
      for (const fileId of fileIds) {
        try {
          await env.img_url.delete(fileId);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete ${fileId}:`, error);
          failedCount++;
        }
      }
    } else if (folder) {
      // 删除整个文件夹的文件
      const files = await env.img_url.list({ limit: 1000 });
      const targetFiles = files.keys.filter(file => 
        (file.metadata?.folder || 'root') === folder
      );
      
      for (const file of targetFiles) {
        try {
          await env.img_url.delete(file.name);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete ${file.name}:`, error);
          failedCount++;
        }
      }
    } else {
      // 删除所有文件
      let cursor = undefined;
      do {
        const batch = await env.img_url.list({ limit: 100, cursor });
        
        for (const file of batch.keys) {
          try {
            await env.img_url.delete(file.name);
            deletedCount++;
          } catch (error) {
            console.error(`Failed to delete ${file.name}:`, error);
            failedCount++;
          }
        }
        
        cursor = batch.list_complete ? undefined : batch.cursor;
      } while (cursor);
    }
    
    return new Response(JSON.stringify({
      success: true,
      deletedCount,
      failedCount,
      message: `成功删除 ${deletedCount} 个文件${failedCount > 0 ? `，${failedCount} 个失败` : ''}`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
