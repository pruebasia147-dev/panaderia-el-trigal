
import { supabase } from "./supabaseClient";
import { INITIAL_PRODUCTS, INITIAL_SETTINGS } from "../constants";
import { AppSettings, Client, Product, Sale, SaleItem, SuspendedSale } from "../types";

class DBService {
  
  // --- Init ---
  async init() {
    // En SQL, verificamos conexión. 
    // Opcional: Si la tabla productos está vacía, sembrar datos iniciales.
    const { data, error } = await supabase.from('products').select('id').limit(1);
    
    if (!error && data && data.length === 0) {
      console.log("Sembrando base de datos con productos iniciales...");
      await supabase.from('products').insert(INITIAL_PRODUCTS);
    }
  }

  // --- Helper ID ---
  private generateId(): string {
    return crypto.randomUUID();
  }

  // --- Products ---
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase.from('products').select('*');
    if (error) console.error("Error fetching products", error);
    return data || [];
  }

  async updateProduct(updatedProduct: Product): Promise<void> {
    // Upsert maneja Insertar si no existe ID, o Actualizar si existe
    const { error } = await supabase.from('products').upsert(updatedProduct);
    if (error) throw error;
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  }

  // --- Clients ---
  async getClients(): Promise<Client[]> {
    const { data, error } = await supabase.from('clients').select('*');
    if (error) console.error(error);
    return data || [];
  }

  async updateClient(updatedClient: Client): Promise<void> {
    const { error } = await supabase.from('clients').upsert(updatedClient);
    if (error) throw error;
  }

  async registerClientPayment(clientId: string, amount: number): Promise<void> {
    // 1. Obtener deuda actual
    const { data: client } = await supabase.from('clients').select('debt').eq('id', clientId).single();
    if (!client) throw new Error("Cliente no encontrado");

    // 2. Calcular nueva deuda
    const newDebt = Math.max(0, client.debt - amount);

    // 3. Actualizar
    const { error } = await supabase.from('clients').update({ debt: newDebt }).eq('id', clientId);
    if (error) throw error;
  }

  // --- Settings ---
  async getSettings(): Promise<AppSettings> {
    const { data } = await supabase.from('settings').select('*').single();
    return data || INITIAL_SETTINGS;
  }

  async saveSettings(settings: AppSettings) {
    // Asumimos ID 1 para settings globales
    await supabase.from('settings').upsert({ id: 1, ...settings });
  }

  // --- Suspended Sales ---
  async getSuspendedSales(): Promise<SuspendedSale[]> {
      const { data } = await supabase.from('suspended_sales').select('*');
      return data || [];
  }

  async addSuspendedSale(sale: SuspendedSale): Promise<void> {
      await supabase.from('suspended_sales').insert(sale);
  }

  async removeSuspendedSale(id: string): Promise<void> {
      await supabase.from('suspended_sales').delete().eq('id', id);
  }

  // --- Sales & Transactions ---
  async getSales(): Promise<Sale[]> {
    const { data, error } = await supabase.from('sales').select('*').order('date', { ascending: false });
    if(error) console.error(error);
    return data || [];
  }

  async updateSale(updatedSale: Sale): Promise<void> {
      // Nota: En un sistema real complejo, actualizar una venta debería revertir stock y deuda.
      // Por simplicidad en este paso, solo actualizamos el registro de venta.
      const { error } = await supabase.from('sales').update(updatedSale).eq('id', updatedSale.id);
      if (error) throw error;
  }

  // Transaction: Retail Sale
  async createRetailSale(items: SaleItem[], sellerId: string): Promise<void> {
    const saleId = this.generateId();
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

    const sale: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      type: 'pos',
      items,
      totalAmount,
      sellerId
    };

    // Usamos RPC o transacciones en el futuro, pero aquí hacemos llamadas secuenciales optimistas
    // 1. Guardar Venta
    const { error: saleError } = await supabase.from('sales').insert(sale);
    if (saleError) throw saleError;

    // 2. Descontar Stock (Uno por uno o crear una funcion RPC en Supabase para hacerlo atómico)
    for (const item of items) {
       await this.decrementStock(item.productId, item.quantity);
    }
  }

  // Transaction: Dispatch Sale
  async createDispatchSale(clientId: string, items: SaleItem[], sellerId: string): Promise<void> {
    const saleId = this.generateId();
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

    // 1. Obtener nombre cliente
    const { data: client } = await supabase.from('clients').select('name, businessName, debt').eq('id', clientId).single();
    if (!client) throw new Error("Cliente no existe");

    const sale: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      type: 'dispatch',
      items,
      totalAmount,
      clientId,
      clientName: client.businessName || client.name,
      sellerId
    };

    // 1. Guardar Venta
    const { error: saleError } = await supabase.from('sales').insert(sale);
    if (saleError) throw saleError;

    // 2. Aumentar Deuda
    await supabase.from('clients').update({ debt: client.debt + totalAmount }).eq('id', clientId);

    // 3. Descontar Stock
    for (const item of items) {
       await this.decrementStock(item.productId, item.quantity);
    }
  }

  // Helper para bajar stock (básico)
  private async decrementStock(productId: string, quantity: number) {
      // Primero leemos el stock actual
      const { data: prod } = await supabase.from('products').select('stock').eq('id', productId).single();
      if (prod) {
          await supabase.from('products').update({ stock: prod.stock - quantity }).eq('id', productId);
      }
  }

  // --- BACKUP & RESTORE (Legacy Local support removed or adapted) ---
  // Supabase tiene sus propios backups automáticos, pero si quieres exportar JSON:
  async getDatabaseDump(): Promise<string> {
      const [p, c, s, st] = await Promise.all([
          this.getProducts(),
          this.getClients(),
          this.getSales(),
          this.getSettings()
      ]);
      
      const dump = {
          products: p,
          clients: c,
          sales: s,
          settings: st,
          backupDate: new Date().toISOString()
      };
      return JSON.stringify(dump, null, 2);
  }

  // Restore en Supabase es peligroso hacerlo desde el frontend ciegamente (borraría todo), 
  // lo mantendremos desactivado o solo para agregar datos.
  async restoreDatabase(jsonString: string): Promise<boolean> {
      alert("La restauración completa vía archivo está deshabilitada en modo Nube por seguridad. Contacte al desarrollador para migraciones masivas.");
      return false;
  }
}

export const db = new DBService();
