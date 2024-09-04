const express = require('express');
const sql = require('mssql');
const cors = require('cors');
require('dotenv').config();
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 8012;
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = socketIo(server);

io.on('connection', (socket) => {
  console.log('New client connected');
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});


const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};


// Establish database connection
sql.connect(dbConfig, err => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Connected to MSSQL');
    }
});


// Route to get a single user by emp_id
app.get('/api/user/:emp_id', async (req, res) => {
    const emp_id = req.params.emp_id;

    try {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('emp_id', sql.VarChar, emp_id)
            .query(`
                SELECT 
                    e.C_DepartmentCode,
                    e.C_EmployeeName,
                    e.C_EmployeeCode,
                    d.C_DepartmentName 
                FROM 
                    Employee AS e 
                    INNER JOIN Department AS d ON e.C_DepartmentCode = d.C_DepartmentCode 
                                              AND e.C_LocationCode = d.C_LocationCode 
                WHERE 
                    e.C_EmployeeCode = @emp_id
            `);

        const data = result.recordset;

        if (data.length === 0) {
            return res.status(404).json({ status: 404, message: "No data found for the provided employee ID" });
        }

        res.status(200).json(data[0]);
    } catch (error) {
        console.error("Error fetching user data:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/////////////////////////////  The new Calls//////////////////////////////////////////////////

app.post('/api/meetingslots/:appointmentType', async (req, res) => {
    try {
      const { appointmentType } = req.params;
      const slots = req.body;
  
      if (!Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({ error: 'Missing required slot information' });
      }
  
      const pool = await sql.connect(dbConfig);
      
      for (const slot of slots) {
        const { slot_from, slot_to, slot_date, meetPersonID, appointment_status} = slot;
  
        if (!slot_from || !slot_to || !slot_date || !appointmentType || !meetPersonID || !appointment_status) {
          return res.status(400).json({ error: 'Missing required slot information' });
        }
          const mdpa ='00001221'
        await pool.request()
          .input('slot_from', sql.NVarChar, slot_from)
          .input('slot_to', sql.NVarChar, slot_to)
          .input('slot_date', sql.Date, slot_date)
          .input('to_meet', sql.NVarChar, appointmentType)
          .input('modified_by_id', sql.NVarChar, mdpa)
          .input('meetPersonID', sql.NVarChar, meetPersonID)
          .input('appointment_status', sql.NVarChar, appointment_status)
          .query(`
            INSERT INTO New_appointments (slot_from, slot_to, slot_date,modified_by_id ,Modified_by,Modified_at, Meet_person, Meet_person_ID, Status)
            VALUES (@slot_from, @slot_to, @slot_date, @modified_by_id,'VEERAMANI V', getdate(), @to_meet, @meetPersonID, @appointment_status)
          `);
      }
  
      res.status(201).json({ message: 'Slots successfully updated' });
    } catch (error) {
      console.error('Error posting data:', error);
      res.status(500).send('Server Error');
    }
  });
  

app.get('/api/meetingslots/:appointmentType', async (req, res) => {
    try {
        const { appointmentType } = req.params;
        const { date } = req.query;
        const pool = await sql.connect(dbConfig);


        const result = await pool.request()
            .input('Meet_person', sql.NVarChar, appointmentType)
            .input('slot_date', sql.Date, date) // Adding date input
            .query(`
                SELECT * 
                FROM New_appointments NA
                WHERE NA.slot_from NOT IN (
                    SELECT slot_from 
                    FROM slot_master SM 
                    WHERE SM.active_flag IN ('A', 'R') OR SM.appoinment_status NOT IN ('ACCEPTED')
                ) 

                AND NA.Meet_person = @Meet_person
                AND NA.slot_date = @slot_date
            `);

        const slots = result.recordset.map(row => ({
            slot_id: row.slot_id,
            slot_from: row.slot_from,
            slot_to: row.slot_to,
            slot_date: row.slot_date,
            Meet_person: row.Meet_person,
            Status: row.Status
        }));

        res.status(200).json({ slots });
    } catch (error) {
        console.error('Error fetching meeting slots:', error);
        res.status(500).send('Server Error');
    }
});


app.put('/api/meetingslots/:slot_id', async (req, res) => {
    const appointmentId = req.params.slot_id;
    const {
      slot_date,
      Discussion_topic,
      Description,
      Department,
      Person_name,
      Employee_id,
      Employee_name,
      Employee_Department,
      user_type,
      Status
    } = req.body;
  
    try {
      const pool = await sql.connect(dbConfig);
  
      // Update New_appointments
      await pool.request()
        .input('appointmentId', sql.Int, appointmentId)
        .input('slot_date', sql.DateTime, slot_date)
        .input('Discussion_topic', sql.NVarChar, Discussion_topic)
        .input('Description', sql.NVarChar, Description)
        .input('Department', sql.NVarChar, Department)
        .input('Person_name', sql.NVarChar, Person_name)
        .input('Employee_id', sql.NVarChar, Employee_id)
        .input('Employee_name', sql.NVarChar, Employee_name)
        .input('Employee_Department', sql.NVarChar, Employee_Department)
        .input('Created_by', sql.NVarChar, Employee_name)
        .input('user_type', sql.NVarChar, user_type)
        .input('Status', sql.NVarChar, Status)
        .query(`
          UPDATE New_appointments 
          SET 
            slot_date = @slot_date,
            Discussion_topic = @Discussion_topic, 
            Description = @Description,
            Department = @Department,
            Person_name = @Person_name,
            Employee_id = @Employee_id,
            Employee_name = @Employee_name,
            Employee_Department = @Employee_Department,
            user_type = @user_type,
            Created_by = @Employee_name,
            Created_dateTime = getdate(),
            Status = @Status
          WHERE slot_id = @appointmentId
        `);
  
      // Emit the notification to all connected clients
      io.emit('appointmentUpdated', {
        slot_id: appointmentId,
        slot_date,
        Discussion_topic,
        Description,
        Department,
        Person_name,
        Employee_id,
        Employee_name,
        Employee_Department,
        user_type,
        Status
      });
  
      res.status(200).json({ message: 'Appointment successfully updated in New_appointments' });
    } catch (error) {
      console.error('Error updating appointment in New_appointments:', error);
      res.status(500).send('Server Error');
    }
  });


  
app.get('/api/emp-appointments/:empId', async (req, res) => {
    const { empId } = req.params;
   
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('employeeId', sql.NVarChar, empId)
            .query('SELECT * FROM New_appointments WHERE Employee_id = @employeeId');
        res.status(200).json(result.recordset);
       
       
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).send('Server Error');
    }
    
});
app.get('/api/dash/md-appoinments/:empId', async (req, res) => {
    const { empId } = req.params;
   
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('employeeId', sql.NVarChar, empId)
            .query('SELECT * FROM New_appointments WHERE Meet_person_ID = @employeeId OR modified_by_id = @employeeId');
        res.status(200).json(result.recordset);
       
       
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).send('Server Error');
    }
    
});
app.get('/api/md-appoinments/:empId', async (req, res) => {
    const { empId } = req.params;
    const { fromDate, toDate } = req.query;

    try {
        const pool = await sql.connect(dbConfig);
        console.log("this function running");
        
        let query = `
            SELECT * 
            FROM New_appointments 
            WHERE modified_by_id = @empId
        `;

        if (fromDate && toDate) {
            query += `
                AND CONVERT(date, slot_date) BETWEEN @FromDate AND @ToDate
            `;
        }

        const request = pool.request()
            .input('empId', sql.NVarChar, empId);

        if (fromDate && toDate) {
            request.input('FromDate', sql.Date, fromDate)
                   .input('ToDate', sql.Date, toDate);
        }

        const result = await request.query(query);

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).send('Server Error');
    }
});

app.get('/api/dates/md-appointmentsreports/:empId', async (req, res) => {
    const { empId } = req.params;
    const { fromDate, toDate } = req.query;

    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('empId', sql.NVarChar, empId)
            .input('FromDate', sql.Date, fromDate)
            .input('ToDate', sql.Date, toDate)
            .query('SELECT * FROM New_appointments WHERE Meet_person_ID = @empId AND CONVERT(date, slot_date) BETWEEN @FromDate AND @ToDate ');
        
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching filtered appointments:', error);
        res.status(500).send('Server Error');
    }
});


// app.get('/api/md-appointmentsreports/:empId', async (req, res) => {
//     const { empId } = req.params;
//     const { fromDate, toDate } = req.query;
//     console.log("the meet person:", empId, "from:", fromDate, "to:", toDate);

//     try {
//         const pool = await sql.connect(dbConfig);
//         const result = await pool.request()
//             .input('empId', sql.NVarChar, empId)
//             .input('FromDate', sql.Date, fromDate)
//             .input('ToDate', sql.Date, toDate)
//             .query('SELECT * FROM New_appointments WHERE Meet_person_ID = @empId AND slot_date >= @FromDate AND slot_date <= @ToDate');
//         res.status(200).json(result.recordset);
//     } catch (error) {
//         console.error('Error fetching filtered appointments:', error);
//         res.status(500).send('Server Error');
//     }
// });


app.get('/api/appointments', async (req, res) => {
      try {
          const pool = await sql.connect(dbConfig);
          const result = await pool.request().query('SELECT * FROM New_appointments');
          res.status(200).json(result.recordset);
      } catch (error) {
          console.error('Error fetching appointments:', error);
          res.status(500).send('Server Error');
      }
    });

// Route to get all appointments

app.get('/api/appointments', async (req, res) => {
    const { fromDate, toDate } = req.query;
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('FromDate', sql.Date, fromDate)
            .input('ToDate', sql.Date, toDate)
            .query('SELECT * FROM New_appointments WHERE slot_date >= @FromDate AND slot_date <= @ToDate');
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).send('Server Error');
    }
});


app.get('/api/departments', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT DISTINCT D.C_DepartmentName FROM Employee AS E LEFT JOIN Department D ON D.C_DepartmentCode = E.C_DepartmentCode ORDER BY D.C_DepartmentName ASC;');
        
        const departmentOptions = result.recordset.map(record => ({
            label: record.C_DepartmentName,
            value: record.C_DepartmentName
        }));
        
        res.json(departmentOptions);
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).send('Server Error');
    }
});

app.get('/api/people/:departmentName', async (req, res) => {
    const department = req.params.departmentName;
    
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('department', sql.NVarChar, department)
            .query(`
                SELECT DISTINCT P.C_EmployeeName 
                FROM Employee AS P
                LEFT JOIN Department D ON D.C_DepartmentCode = P.C_DepartmentCode
                WHERE D.C_DepartmentName = @department
            `);
        
        const peopleOptions = result.recordset;
        res.json(peopleOptions);
    } catch (error) {
        console.error('Error fetching people:', error);
        res.status(500).send('Server Error');
    }
});

app.put('/api/appointments/new/:slot_id', async (req, res) => {
    const { slot_id } = req.params;
    const { status, Approved_by } = req.body;
  
    try {
      const pool = await sql.connect(dbConfig);
  
      const result = await pool.request()
        .input('Status', sql.NVarChar, status)
        .input('Approved_By', sql.NVarChar, Approved_by)
        .input('slot_id', sql.NVarChar, slot_id)
        .query('UPDATE New_appointments SET Status = @Status, Approved_By = @Approved_By, Approved_dateTime = GETDATE() WHERE slot_id = @slot_id');
  
      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({ message: 'Appointment not found in New_appointments' });
      }
  
      // Emit notification event
      io.emit('appointmentUpdated', {
        slot_id,
        status,
        Approved_by,
        message: 'Appointment status updated successfully'
      });
  
      res.status(200).json({ message: 'Appointment status updated successfully in New_appointments' });
    } catch (error) {
      console.error('Error updating appointment status in New_appointments:', error);
      res.status(500).send('Server Error');
    }
  });
  
app.put('/api/appointments/slot_master/:slot_from/:to_meet', async (req, res) => {
    const { slot_from, to_meet } = req.params;
    const { status } = req.body;
    try {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('slot_from', sql.NVarChar, slot_from)
            .input('Meet_person', sql.NVarChar, to_meet)
            .input('appoinment_status', sql.NVarChar, status)
            .query(`
                UPDATE slot_master 
                SET appoinment_status = @appoinment_status 
                WHERE slot_from = @slot_from AND to_meet = @Meet_person;
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Appointment not found in slot_master' });
        }

        res.status(200).json({ message: 'Appointment status updated successfully in slot_master' });
    } catch (error) {
        console.error('Error updating appointment status in slot_master:', error);
        res.status(500).send('Server Error');
    }
});



app.delete('/api/appointments/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('id', sql.NVarChar, id)
            .query('DELETE FROM New_appointments WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        res.status(200).json({ message: 'Appointment deleted successfully' });
    } catch (error) {
        console.error('Error deleting appointment:', error);
        res.status(500).send('Server Error');
    }
});

    

    
app.post('/api/slots', async (req, res) => {
    try {
        const slots = req.body;

        const pool = await sql.connect(dbConfig);

        for (const slot of slots) {
            const { slot_from, slot_to, to_meet, active_flag, appoinment_status } = slot;

            // Check for missing required fields
            if (!slot_from || !slot_to || !to_meet || !active_flag || !appoinment_status) {
                return res.status(400).json({ error: "Missing required slot information" });
            }
            // Insert into slot_master table
            await pool.request()
                .input('slot_from', sql.NVarChar, slot_from)
                .input('slot_to', sql.NVarChar, slot_to)
                .input('to_meet', sql.NVarChar, to_meet)
                .input('active_flag', sql.NVarChar, active_flag)
                .input('appoinment_status', sql.NVarChar, appoinment_status)
                .query(`
                    INSERT INTO slot_master (slot_from, slot_to, to_meet, active_flag,appoinment_status)
                    VALUES (@slot_from, @slot_to, @to_meet, @active_flag, @appoinment_status)
                `);

            // Update active_flag in slot_default table
            await pool.request()
                .input('slot_from', sql.NVarChar, slot_from)
                .input('slot_to', sql.NVarChar, slot_to)
                .input('to_meet', sql.NVarChar, to_meet)
                .query(`
                    UPDATE slot_default
                    SET active_flag = 'A'
                    WHERE slot_from = @slot_from AND slot_to = @slot_to AND to_meet = @to_meet
                `);
        }
        res.status(201).json({ message: 'Slots successfully inserted and updated' });
    } catch (error) {
        console.error('Error inserting slots:', error);
        res.status(500).send('Server Error');
    }
}); 
    
  

app.get('/api/slot_default/:appointmentType', async (req, res) => {
    try {
      const { appointmentType } = req.params;
      const { date } = req.query; // Get the date from query parameters
  
      const pool = await sql.connect(dbConfig);
      const result = await pool.request()
        .input('to_meet', sql.NVarChar, appointmentType)
        .input('slot_date', sql.Date, date) // Use the provided date
        .query(`
          SELECT * FROM slot_default s
          WHERE s.to_meet = @to_meet 
          AND s.slot_from NOT IN (
            SELECT slot_from 
            FROM New_appointments n 
            WHERE s.to_meet = n.Meet_person 
            AND n.slot_date = @slot_date
          )
        `);
  
      const slots = result.recordset.map(row => ({
        slot_from: row.slot_from,
        slot_to: row.slot_to,
        active_flag: row.active_flag,
        to_meet: row.to_meet,
        appointment_status: row.appointment_status
      }));
  
      res.status(200).json({ slots });
    } catch (error) {
      console.error('Error fetching slots:', error);
      res.status(500).send('Server Error');
    }
  });
  
    

    app.get('/api/slot_appointment/:appointmentType', async (req, res) => {
       
        try {
            const { appointmentType } = req.params;
         
    
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('to_meet', sql.NVarChar, appointmentType)
                .query('SELECT slot_date, slot_from, slot_to, active_flag, to_meet ,appoinment_status FROM slot_appointment WHERE to_meet = @to_meet');
    
          
            res.status(200).json({ slots: result.recordset });
        } catch (error) {
            console.error('Error fetching slots:', error);
            res.status(500).send('Server Error');
        }
    });
    
    app.post('/api/slotmaster/truncate', async (req, res) => {
        try {
          const pool = await sql.connect(dbConfig);
      
          await pool.request().query('TRUNCATE TABLE slot_master');
      
          res.status(200).json({ message: 'Slot master table truncated successfully' });
        } catch (error) {
          console.error('Error truncating slot master table:', error);
          res.status(500).send('Server Error');
        }
      });
 // Handle all other routes with index.html

  // Start the server
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
    